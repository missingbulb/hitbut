// The backfill: an archive walked in finite slices, one Workflow run per slice.
//
// The cron covers the moving edge. This covers everything before it — decades of archive,
// which is thousands of slices, so the two properties that matter are both about what a
// slice costs when it goes wrong.
//
// **Slices are independent.** A slice reads and writes nothing another slice relies on, so
// one bad slice costs one retry rather than a restart. That is a claim about this code, and
// the case for `3.11` holds it to it.
//
// **A retried step does not re-fetch.** The platform's retry re-runs a whole step, and every
// fetch inside one is a request to somebody else's server. A step that re-fetched on each
// retry would turn one flaky model call into a second crawl of the slice — and the traffic
// most likely to get us blocked is the traffic we did not need to send.
import type { Corpus } from '../corpus/store.ts';
import type { R2Bucket } from '../env.ts';
import type { RosterEntry } from '../corpus/roster.ts';
import type { SourceModule } from '../acquisition/registry.ts';
import { fetchPage, type FetchDeps, type FetchOptions } from '../acquisition/fetcher.ts';
import { ingest, type IngestDeps } from '../ingestion/pipeline.ts';
import { readSourceDate } from '../corpus/dates.ts';
import { archiveRawKey } from '../raw-keys.ts';

/** One window of one archive: the unit a Workflow run covers. */
export type Slice = {
  sourceModule: string;
  /** Inclusive, `YYYY-MM-DD`. What "a year of one archive" means concretely. */
  from: string;
  to: string;
};

export type SliceOutcome = {
  slice: Slice;
  /** Documents pulled from the network this run. A retry adds none of these. */
  fetched: number;
  /** Already in the raw cache, so no request was issued. */
  cached: number;
  utterances: number;
  unattributed: number;
  /** Per document, why it did not land. A slice reports rather than throws. */
  failures: { key: string; reason: string }[];
};

export type SliceDeps = {
  corpus: Corpus;
  raw: R2Bucket;
  roster: RosterEntry[];
  ingestion: Omit<IngestDeps, 'corpus'>;
  fetchDeps: FetchDeps;
  now: () => string;
  fetch?: FetchOptions;
};

/**
 * Runs one slice: fetch what is missing, then put every document through the same ingestion
 * chain the cron uses. Never throws — the outcome is what a Workflow step reads to decide
 * whether this slice is worth retrying.
 */
export async function runSlice(deps: SliceDeps, module: SourceModule, slice: Slice): Promise<SliceOutcome> {
  const outcome: SliceOutcome = { slice, fetched: 0, cached: 0, utterances: 0, unattributed: 0, failures: [] };

  const documents = (await module.list()).filter((document) => inSlice(document.key, slice));

  for (const document of documents) {
    const key = archiveRawKey(module, document.key);
    let payload: string;

    // The whole of the no-re-fetch rule: what a previous attempt stored is what this one
    // reads. R2 is the memory between retries, because a step's own variables are not.
    const stored = await deps.raw.get(key);
    if (stored) {
      payload = await stored.text();
      outcome.cached += 1;
    } else {
      const result = await fetchPage(document.url, deps.fetchDeps, deps.fetch);
      if (!result.ok) {
        outcome.failures.push({ key: document.key, reason: result.reason });
        continue;
      }
      // Before anything interprets it, and before the source row exists: a payload that
      // crashes the parser is still on disk to debug against.
      await deps.raw.put(key, result.body);
      payload = result.body;
      outcome.fetched += 1;
    }

    try {
      const landed = await ingestDocument(deps, module, document, key, payload);
      outcome.utterances += landed.utterances;
      outcome.unattributed += landed.unattributed;
    } catch (error) {
      outcome.failures.push({ key: document.key, reason: `extraction: ${String(error)}` });
    }
  }

  return outcome;
}

/** Whether a document belongs to this slice, by the date its own key carries. */
export function inSlice(key: string, slice: Slice): boolean {
  const dated = /(\d{4}-\d{2}-\d{2})/.exec(key)?.[1];
  // A key with no date in it belongs to no slice. Guessing would put a document in a window
  // nobody established it was in, and the backfill's whole shape is windows.
  return dated !== undefined && dated >= slice.from && dated <= slice.to;
}

async function ingestDocument(
  deps: SliceDeps,
  module: SourceModule,
  document: { key: string; url: string },
  rawKey: string,
  payload: string,
): Promise<{ utterances: number; unattributed: number }> {
  const source = await deps.corpus.recordSource({
    url: document.url,
    publisher: module.publisher,
    kind: module.kind,
    fetchedAt: deps.now(),
    rawKey,
    extraction: 'pending',
    sourceModule: module.id,
    externalKey: document.key,
  });

  let utterances = 0;
  let unattributed = 0;
  for (const raw of module.extract(payload, document)) {
    const figure = await deps.corpus.resolveSpeaker(deps.roster, raw.speaker.displayName);
    if (!figure) {
      await deps.corpus.recordUnattributed(source.id, {
        speakerName: raw.speaker.displayName,
        speakerRole: raw.speaker.role,
        ordinal: raw.ordinal,
        quote: raw.quote,
        language: raw.language,
        saidAt: raw.saidAt,
        context: raw.context,
      });
      unattributed += 1;
      continue;
    }
    const landed = await ingest({ corpus: deps.corpus, ...deps.ingestion }, {
      figureId: figure.id,
      text: raw.quote,
      language: raw.language,
      saidAt: readSourceDate(raw.saidAt),
      venue: raw.venue ?? module.venue,
      audience: raw.audience ?? null,
      sourceId: source.id,
    });
    if (landed.minted) utterances += 1;
  }

  await deps.corpus.setExtractionStatus(source.id, 'extracted');
  return { utterances, unattributed };
}
