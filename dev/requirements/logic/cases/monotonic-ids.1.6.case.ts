import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { createUlidFactory } from '../../../../src/backend/corpus/ids.ts';

export default {
  title: 'ids minted in the same millisecond are distinct and still sort in mint order',
  async run() {
    // One payload yields many statements at once, so "the same millisecond" is the
    // ordinary case rather than the edge one.
    const frozen = createUlidFactory({ now: () => 1_781_000_000_000, random: () => 0.5 });
    const minted = [frozen(), frozen(), frozen(), frozen()];

    assert.equal(new Set(minted).size, minted.length, 'no id is ever handed out twice');
    assert.deepEqual([...minted].sort(), minted, 'lexicographic order is mint order');
    assert.equal(new Set(minted.map((id) => id.slice(0, 10))).size, 1, 'and they do share the timestamp');
  },
} satisfies Case<void>;
