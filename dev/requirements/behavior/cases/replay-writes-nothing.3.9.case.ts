import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { acquisitionWorld, payloadOf } from '../../shared/acquisition-harness.ts';
import { runAcquisition, reextract } from '../../../../src/backend/acquisition/run.ts';

const PLEDGE = 'לא אצביע בעד תקציב שגורע ולו שקל אחד מהרכבת הקלה.';
const DENIAL = 'הרכבת הקלה מעולם לא הייתה בעדיפות שלי.';

const PROTOCOL = payloadOf([
  ['דמות לדוגמה', '2024-03-12', 'רכבת קלה', PLEDGE],
  ['דמות לדוגמה', '2026-06-03', 'רכבת קלה', DENIAL],
]);

/** What the whole corpus holds, so a replay can be compared against it wholesale. */
async function census(corpus: Awaited<ReturnType<typeof acquisitionWorld>>['corpus'], figureId: string) {
  const utterances = await corpus.utterancesFor(figureId);
  const attestations = [];
  const clusters = new Set<string>();
  const stances = [];
  for (const utterance of utterances) {
    attestations.push(...(await corpus.attestationsFor(utterance.id)).map((a) => a.id));
    const member = await corpus.clusterOf(utterance.id);
    if (member) clusters.add(member.clusterId);
    stances.push(...(await corpus.stancesFor(utterance.id)).map((s) => s.id));
  }
  return {
    utterances: utterances.map((u) => u.id).sort(),
    attestations: attestations.sort(),
    clusters: [...clusters].sort(),
    stances: stances.sort(),
  };
}

export default {
  title: 'replaying a payload through ingestion writes nothing new',
  async run() {
    const world = await acquisitionWorld(
      [{ key: 'protocol-1', url: 'https://example.org/protocols/1', payload: PROTOCOL }],
      {},
      { [PLEDGE]: 0.9, [DENIAL]: -0.6 },
    );
    const figureId = (await world.corpus.resolveSpeaker(world.options.roster, 'דמות לדוגמה'))!.id;

    const [first] = await runAcquisition(world.options);
    assert.equal(first?.utterances, 2, 'the pass minted an utterance per thing said');
    assert.deepEqual(first?.incomplete, [], 'and reached the last stage for both');

    const after = await census(world.corpus, figureId);
    assert.equal(after.utterances.length, 2);
    assert.equal(after.attestations.length, 2);
    assert.equal(after.stances.length, 2);
    const modelCalls = { embed: world.embedder.calls, stance: world.stance.calls };

    // A parser fix replays every cached payload. Nothing about that is new information.
    const sourceId = (await world.corpus.findSource('fixture-source', 'protocol-1'))!.id;
    const replay = await reextract(world.options, sourceId);

    assert.equal(replay.utterances, 0, 'a replay mints nothing');
    assert.deepEqual(await census(world.corpus, figureId), after, 'and the corpus is byte-for-byte where it was');
    assert.deepEqual(
      { embed: world.embedder.calls, stance: world.stance.calls },
      modelCalls,
      'and pays neither model a second time — which is what makes backfilling decades affordable',
    );

    // A whole second acquisition pass is the other way a replay arrives: the source is
    // already extracted, so it is skipped outright.
    const [again] = await runAcquisition(world.options);
    assert.equal(again?.skipped, 1);
    assert.deepEqual(await census(world.corpus, figureId), after);
  },
} satisfies Case<void>;
