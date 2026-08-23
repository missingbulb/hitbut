import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { acquisitionWorld, payloadOf } from '../../shared/acquisition-harness.ts';
import { reextract, runAcquisition } from '../../../../src/backend/acquisition/run.ts';

const PLEDGE = 'לא אצביע בעד תקציב שגורע ולו שקל אחד מהרכבת הקלה.';
const PROTOCOL = payloadOf([['דמות לדוגמה', '2024-03-12', 'רכבת קלה', PLEDGE]]);

export default {
  title: 'a stage that fails leaves the stages before it landed, and the next pass resumes there',
  async run() {
    const world = await acquisitionWorld(
      [{ key: 'protocol-1', url: 'https://example.org/protocols/1', payload: PROTOCOL }],
      {},
      { [PLEDGE]: 0.9 },
    );
    const figureId = (await world.corpus.resolveSpeaker(world.options.roster, 'דמות לדוגמה'))!.id;

    // The stance model rate-limits, the way a real one does under a backfill.
    world.stance.failWith = '429 too many requests';

    const [pass] = await runAcquisition(world.options);

    // The utterance is not lost. Losing it would mean re-fetching, re-extracting and
    // re-paying for the embedding to get back to exactly here.
    assert.equal(pass?.utterances, 1, 'the utterance still landed');
    assert.equal(pass?.failures.length, 0, 'and a model that rate-limited is not a failed document');
    assert.deepEqual(
      pass?.incomplete.map((stopped) => stopped.reached),
      ['assigned'],
      'the pass reports exactly how far it got — which is what a Workflow step reads to decide on a retry',
    );
    assert.match(pass?.incomplete[0]?.because ?? '', /429/, 'and why it stopped, in the words the model used');

    const [utterance] = await world.corpus.utterancesFor(figureId);
    assert.ok(utterance, 'merged');
    assert.ok(await world.vectors.has(utterance.id), 'embedded');
    assert.ok(await world.corpus.clusterOf(utterance.id), 'assigned');
    assert.deepEqual(await world.corpus.stancesFor(utterance.id), [], 'and only the stance is missing');

    const embedCalls = world.embedder.calls;

    // The next pass, with the model answering again.
    world.stance.failWith = null;
    const sourceId = (await world.corpus.findSource('fixture-source', 'protocol-1'))!.id;
    const resumed = await reextract(world.options, sourceId);

    assert.deepEqual(resumed.incomplete, [], 'it finishes');
    assert.equal((await world.corpus.stancesFor(utterance.id)).length, 1, 'and the stance is now recorded');
    assert.equal(
      world.embedder.calls,
      embedCalls,
      'without re-embedding: it resumed from where it stopped rather than starting the chain again',
    );
    assert.equal((await world.corpus.utterancesFor(figureId)).length, 1, 'and minted nothing on the way through');
  },
} satisfies Case<void>;
