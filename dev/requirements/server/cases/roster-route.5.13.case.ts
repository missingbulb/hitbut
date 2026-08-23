import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { RosterView } from '../../../../src/shared/api.ts';

export default {
  title: 'GET /roster returns the public-eye test the roster applies, with the people it admits',
  async run(api: ApiContext) {
    const roster = await api.json<RosterView>('/api/v1/roster');

    // The test, written once. Without it the list is people somebody chose.
    assert.ok(roster.inclusionRule.trim().length > 0);

    // The people, with what each of them says about meeting it. Without those the test is
    // a policy nobody applied.
    assert.equal(roster.figures.length, 3);
    for (const figure of roster.figures) {
      assert.ok((figure.qualifies ?? '').trim().length > 0, `${figure.id} is on the roster with nothing said about why`);
    }

    // One response, so the page cannot render half of itself — which is the whole reason
    // this is a route rather than two.
    assert.deepEqual(
      Object.keys(roster).sort(),
      ['figures', 'inclusionRule'],
      'both halves arrive together or neither does',
    );
  },
} satisfies Case<ApiContext>;
