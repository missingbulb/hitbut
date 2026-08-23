import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { acquisitionWorld, payloadOf } from '../../shared/acquisition-harness.ts';
import { runAcquisition } from '../../../../src/backend/acquisition/run.ts';

export default {
  title: 'one document failing does not abandon the rest of the batch',
  async run() {
    const world = await acquisitionWorld([
      { key: 'gone', url: 'https://example.org/gone', payload: '', response: { status: 404, body: 'not found' } },
      {
        key: 'fine',
        url: 'https://example.org/fine',
        payload: payloadOf([['דמות לדוגמה', '2026-02-02', 'תקציב', 'אמירה שנקלטה כרגיל.']]),
      },
      { key: 'broken', url: 'https://example.org/broken', payload: '', response: new Error('connection reset') },
    ]);

    // Exits normally: a source that declined is a signal for a human, not a pipeline fault.
    const [outcome] = await runAcquisition(world.options);

    assert.equal(outcome.utterances, 1, 'the healthy document still landed');
    assert.deepEqual(
      outcome.failures.map((failure) => [failure.key, failure.reason]),
      [['gone', 'http'], ['broken', 'network']],
      'and each failure is recorded with its own reason',
    );
    assert.equal((await world.corpus.utterancesFor(
      (await world.corpus.resolveSpeaker(world.options.roster, 'דמות לדוגמה'))!.id,
    )).length, 1, 'and it is in the corpus, not just counted');
  },
} satisfies Case<void>;
