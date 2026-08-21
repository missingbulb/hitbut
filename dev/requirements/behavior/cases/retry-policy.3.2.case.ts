import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { scriptedFetch } from '../../shared/fakes.ts';
import { fetchPage } from '../../../../src/backend/acquisition/fetcher.ts';

export default {
  title: 'a fetch retries a gateway error and gives up on a client error immediately',
  async run() {
    const flaky = scriptedFetch([
      { status: 503, body: 'service unavailable' },
      { status: 502, body: 'bad gateway' },
      { status: 200, body: 'the document' },
    ]);
    const recovered = await fetchPage('https://example.org/a', flaky.deps, { attempts: 3, backoffMs: 100 });
    assert.equal(recovered.ok, true);
    assert.equal(recovered.attempts, 3);
    assert.deepEqual(flaky.waits, [100, 200], 'the wait doubles between attempts');

    // A client error is about our request and will answer the same way forever; retrying
    // it wastes the budget and looks like traffic worth blocking.
    const refused = scriptedFetch([{ status: 404, body: 'not found' }]);
    const gone = await fetchPage('https://example.org/b', refused.deps, { attempts: 3 });
    assert.equal(gone.ok, false);
    assert.equal(gone.attempts, 1, 'one attempt only');
    assert.deepEqual(refused.calls, ['https://example.org/b']);
    assert.equal(gone.ok === false && gone.reason, 'http');

    const rateLimited = scriptedFetch([{ status: 429, body: 'slow down' }]);
    const persisted = await fetchPage('https://example.org/c', rateLimited.deps, { attempts: 2 });
    assert.equal(persisted.attempts, 2, '429 is worth another attempt');
  },
} satisfies Case<void>;
