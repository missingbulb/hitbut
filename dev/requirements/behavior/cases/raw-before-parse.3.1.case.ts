import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { acquisitionWorld, payloadOf } from '../../shared/acquisition-harness.ts';
import { runAcquisition } from '../../../../src/backend/acquisition/run.ts';

export default {
  title: 'the raw payload reaches the cache before any parser reads it',
  async run() {
    const payload = payloadOf([['דמות לדוגמה', '2026-01-05', 'תקציב', 'אמירה ראשונה לדוגמה.']]);
    const world = await acquisitionWorld([{ key: 'protocol-1', url: 'https://example.org/protocols/1', payload }]);

    await runAcquisition(world.options);

    // Ordering, not merely presence: a payload that crashes the parser must still be on
    // disk to debug against and to replay.
    const put = world.log.findIndex((entry) => entry.startsWith('put '));
    const extract = world.log.indexOf('extract protocol-1');
    assert.ok(put !== -1, 'the payload was never written to the cache');
    assert.ok(extract !== -1, 'the extractor never ran');
    assert.ok(put < extract, `the parser ran first: ${world.log.join(' → ')}`);

    assert.deepEqual([...world.raw.objects.values()], [payload], 'and what was stored is the response verbatim');
  },
} satisfies Case<void>;
