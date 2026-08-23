// One passage, all the way in: merge it into an utterance, embed it, put it in a subject,
// and record where it stands. The chain that turns a document into something the analysis
// can reason about, in one module so a backfill Workflow and the nightly cron run exactly
// the same code (#34 phase 4).
//
// Two properties shape all of it.
//
// **Every stage is keyed on something the payload determines**, so replaying a payload
// finds its own work already done rather than writing a second copy. Backfilling decades
// means replaying constantly — a parser fix re-runs every cached payload, a failed
// Workflow step re-runs its slice — and duplicates would fill a persona's timeline with
// copies of one sentence that the analysis then reads as agreement.
//
// **Each stage commits before the next starts**, and a failure is reported rather than
// thrown. Embedding and stance are model calls that rate-limit, time out and cost money;
// losing the utterance because the stance call failed would mean re-fetching, re-extracting
// and re-paying for the whole chain on the next attempt.
import type { Corpus, ReportedUtterance } from '../corpus/store.ts';
import type { Utterance } from '../../shared/types.ts';
import type { Embedder, StanceModel, Vectors } from './ports.ts';

/**
 * How near an utterance must fall to join an existing subject rather than open one.
 *
 * A policy number, not a fact: too low and one subject splinters into near-duplicates, too
 * high and unrelated things merge and every stance series becomes noise. Phase 5 tunes it
 * against a real corpus; until then it is deliberately conservative — splintering is
 * recoverable by merging subjects later, and a merged subject has already destroyed the
 * distinction.
 */
export const NEAR_ENOUGH = 0.35;

/** How many neighbours the stance model is shown to infer the subject's axis from. */
const AXIS_SAMPLE = 5;

/** The stages, in order. A run reports the last one it completed. */
export const STAGES = ['merged', 'embedded', 'assigned', 'placed'] as const;
export type Stage = (typeof STAGES)[number];

export type IngestOutcome = {
  utterance: Utterance;
  /** False when this passage was already held as an utterance and only added an attestation. */
  minted: boolean;
  /** The last stage that committed. Anything after it is still to do on a later pass. */
  reached: Stage;
  /** Why it stopped short, when it did. The caller decides whether that is worth a retry. */
  stoppedBecause: string | null;
};

export type IngestDeps = {
  corpus: Corpus;
  embedder: Embedder;
  vectors: Vectors;
  stance: StanceModel;
};

/**
 * Runs one reported passage through the whole chain. Never throws for a stage failure —
 * the outcome says how far it got, which is what a Workflow step reads to decide whether
 * to retry, and what a caller sums to report a pass.
 */
export async function ingest(deps: IngestDeps, reported: ReportedUtterance): Promise<IngestOutcome> {
  // 1. Merge. Idempotent on (speaker, folded words, date, venue): the same speech from a
  //    second document becomes another attestation of the utterance we already hold.
  const { utterance, merged } = await deps.corpus.recordReported(reported);
  const outcome: IngestOutcome = { utterance, minted: !merged, reached: 'merged', stoppedBecause: null };

  // 2. Embed. Keyed on the utterance id, so a replay neither re-pays the model nor writes
  //    a second vector. An utterance that merged into an existing one is already embedded.
  let vector: number[];
  try {
    if (await deps.vectors.has(utterance.id)) {
      outcome.reached = 'embedded';
      // Already embedded means already assigned and placed by the pass that embedded it,
      // unless that pass stopped in between — so the stages below still run and find their
      // own work done.
      vector = [];
    } else {
      vector = await deps.embedder.embed(utterance.text);
      await deps.vectors.upsert(utterance.id, vector);
      outcome.reached = 'embedded';
    }
  } catch (error) {
    outcome.stoppedBecause = `embed: ${String(error)}`;
    return outcome;
  }

  // 3. Assign. The nearest existing subject if anything is near enough, otherwise a new
  //    one — which is the whole of "subjects are discovered": nothing is edited anywhere
  //    for the corpus to become able to be about something new.
  let clusterId: string;
  try {
    const existing = await deps.corpus.clusterOf(utterance.id);
    if (existing) {
      clusterId = existing.clusterId;
    } else {
      const near = vector.length ? await nearestOther(deps, vector, utterance.id) : null;
      const assigned = await deps.corpus.assignToCluster(
        utterance.id,
        near && near.distance <= NEAR_ENOUGH ? await subjectOf(deps, near.id) : null,
        near?.distance ?? null,
      );
      clusterId = assigned.clusterId;
    }
    outcome.reached = 'assigned';
  } catch (error) {
    outcome.stoppedBecause = `assign: ${String(error)}`;
    return outcome;
  }

  // 4. Place. Idempotent on (utterance, model, prompt): the same judgment is not re-paid
  //    for, and a new model or prompt writes its own row beside the old one.
  try {
    const already = await deps.corpus.stancesFor(utterance.id);
    const same = already.find(
      (stance) => stance.modelVersion === deps.stance.modelVersion && stance.promptVersion === deps.stance.promptVersion,
    );
    if (!same) {
      const placement = await deps.stance.place({
        text: utterance.text,
        neighbours: await axisOf(deps, clusterId, utterance.id),
      });
      await deps.corpus.recordStance({
        utteranceId: utterance.id,
        clusterId,
        position: placement.position,
        confidence: placement.confidence,
        modelVersion: deps.stance.modelVersion,
        promptVersion: deps.stance.promptVersion,
      });
    }
    outcome.reached = 'placed';
  } catch (error) {
    outcome.stoppedBecause = `place: ${String(error)}`;
  }

  return outcome;
}

/** The nearest vector that is not this utterance's own. */
async function nearestOther(deps: IngestDeps, vector: number[], self: string) {
  const found = await deps.vectors.nearest(vector, 2);
  return found.find((neighbour) => neighbour.id !== self) ?? null;
}

/** The subject an already-ingested utterance belongs to, if it has one yet. */
async function subjectOf(deps: IngestDeps, utteranceId: string): Promise<string | null> {
  return (await deps.corpus.clusterOf(utteranceId))?.clusterId ?? null;
}

/**
 * What the subject's axis already looks like: a sample of its placed members, so the model
 * places this utterance against the positions its neighbours were given rather than against
 * a scale it invents per call.
 */
async function axisOf(deps: IngestDeps, clusterId: string, self: string) {
  const members = (await deps.corpus.clusterMembers(clusterId))
    .filter((member) => member.utteranceId !== self)
    .slice(0, AXIS_SAMPLE);

  const axis: { text: string; position: number }[] = [];
  for (const member of members) {
    const utterance = await deps.corpus.getUtterance(member.utteranceId);
    const stance = (await deps.corpus.stancesFor(member.utteranceId)).find(
      (recorded) => recorded.modelVersion === deps.stance.modelVersion && recorded.promptVersion === deps.stance.promptVersion,
    );
    if (utterance && stance) axis.push({ text: utterance.text, position: stance.position });
  }
  return axis;
}
