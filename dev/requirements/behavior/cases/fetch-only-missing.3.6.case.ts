import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { acquisitionWorld, payloadOf } from '../../shared/acquisition-harness.ts';
import { runAcquisition } from '../../../../src/backend/acquisition/run.ts';

export default {
  title: 'a re-run fetches nothing it already has, and re-fetches everything when forced',
  async run() {
    const world = await acquisitionWorld([
      {
        key: 'protocol-1',
        url: 'https://example.org/protocols/1',
        payload: payloadOf([['דמות לדוגמה', '2026-03-03', 'תקציב', 'אמירה לדוגמה.']]),
      },
    ]);

    const [first] = await runAcquisition(world.options);
    assert.equal(first.fetched, 1);
    assert.equal(world.http.calls.length, 1);

    const [second] = await runAcquisition(world.options);
    assert.equal(second.skipped, 1, 'already cached and already extracted');
    assert.equal(world.http.calls.length, 1, 'a repeat run issues no request at all');

    // The only way a changed upstream page is re-read.
    const [forced] = await runAcquisition({ ...world.options, force: true });
    assert.equal(forced.fetched, 1);
    assert.equal(world.http.calls.length, 2);
  },
} satisfies Case<void>;
