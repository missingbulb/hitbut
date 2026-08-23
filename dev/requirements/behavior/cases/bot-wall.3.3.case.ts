import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { scriptedFetch } from '../../shared/fakes.ts';
import { fetchPage } from '../../../../src/backend/acquisition/fetcher.ts';
import { acquisitionWorld } from '../../shared/acquisition-harness.ts';
import { runAcquisition } from '../../../../src/backend/acquisition/run.ts';

const INTERSTITIAL = '<html><head><title>Just a moment...</title></head><body>Checking your browser…</body></html>';

export default {
  title: 'an anti-bot interstitial is recorded as blocked, never as content',
  async run() {
    // It arrives as a perfectly ordinary 200, which is exactly why it needs its own check.
    const walled = scriptedFetch([{ status: 200, body: INTERSTITIAL }]);
    const result = await fetchPage('https://example.org/walled', walled.deps, { attempts: 3 });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, 'blocked');
    assert.equal(result.attempts, 1, 'retrying is the traffic that earned the refusal');

    const world = await acquisitionWorld([
      { key: 'walled-1', url: 'https://example.org/walled', payload: '', response: { status: 200, body: INTERSTITIAL } },
    ]);
    const [outcome] = await runAcquisition(world.options);

    assert.deepEqual(outcome.failures.map((failure) => failure.reason), ['blocked']);
    assert.equal(outcome.utterances, 0);
    assert.equal(world.raw.objects.size, 0, 'a challenge page is not cached as if it were the document');
    const source = await world.corpus.findSource(world.registry.all()[0].id, 'walled-1');
    assert.equal(source?.extraction, 'blocked', 'the source reads as blocked, not as one that never said anything');
  },
} satisfies Case<void>;
