import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { scriptedFetch } from '../../shared/fakes.ts';
import { fetchPage } from '../../../../src/backend/acquisition/fetcher.ts';

export default {
  title: 'an empty body fails that fetch and is not retried',
  async run() {
    const empty = scriptedFetch([{ status: 200, body: '   \n  ' }]);
    const result = await fetchPage('https://example.org/empty', empty.deps, { attempts: 4 });

    assert.equal(result.ok, false, 'nothing rendered, so this is not a successful fetch of an empty document');
    assert.equal(result.ok === false && result.reason, 'empty');
    assert.equal(result.attempts, 1, 'a successful-but-empty response stays successful and empty');
    assert.deepEqual(empty.waits, [], 'and nothing waited for it to change its mind');
  },
} satisfies Case<void>;
