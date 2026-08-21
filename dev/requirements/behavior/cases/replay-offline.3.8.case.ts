import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { acquisitionWorld, payloadOf } from '../../shared/acquisition-harness.ts';
import { runAcquisition, reextract } from '../../../../src/backend/acquisition/run.ts';
import { forbiddenFetch } from '../../shared/fakes.ts';

export default {
  title: 'a parser fix replays from the cached payload without touching the network',
  async run() {
    const world = acquisitionWorld([
      {
        key: 'protocol-1',
        url: 'https://example.org/protocols/1',
        payload: payloadOf([['דמות לדוגמה', '2026-04-04', 'תקציב', 'אמירה לדוגמה עם פיסוק שגוי .']]),
      },
    ]);
    await runAcquisition(world.options);
    const source = await world.corpus.findSource('fixture-source', 'protocol-1');
    const before = await world.corpus.timeline((await world.corpus.listFigures()).figures[0].id);
    const callsAfterFetch = world.http.calls.length;

    // Any fetch from here on throws, so a network read is a failure rather than a slow test.
    const offline: typeof world.options = { ...world.options, deps: forbiddenFetch };
    await reextract(offline, source!.id);

    assert.equal(world.http.calls.length, callsAfterFetch, 'the replay issued no request');
    const after = await world.corpus.timeline((await world.corpus.listFigures()).figures[0].id);
    assert.deepEqual(after.map((statement) => statement.id), before.map((statement) => statement.id),
      'and everything anyone cited kept its id');
  },
} satisfies Case<void>;
