import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { SearchResults } from '../../../../src/shared/api.ts';

export default {
  title: 'GET /search answers a Hebrew query whose term carries an attached prefix',
  async run(api: ApiContext) {
    // The logic case proves the folding; this proves the deployed route runs it against
    // the real index rather than against a copy of the rules that drifted.
    const prefixed = await api.json<SearchResults>(`/api/v1/search?q=${encodeURIComponent('בכנסת')}`);
    assert.deepEqual(prefixed.hits.map((hit) => hit.statement.id), [api.seeded.statements.knessetBudgetDelay]);
    assert.equal(prefixed.query, 'בכנסת');
    assert.equal(prefixed.hits[0].figure.displayName, 'נטע קרליבך', 'a hit carries its speaker');

    const bare = await api.json<SearchResults>(`/api/v1/search?q=${encodeURIComponent('כנסת')}`);
    assert.deepEqual(bare.hits.map((hit) => hit.statement.id), [api.seeded.statements.knessetBudgetDelay]);

    const across = await api.json<SearchResults>(`/api/v1/search?q=${encodeURIComponent('דיור')}`);
    assert.deepEqual(across.hits.map((hit) => hit.statement.id).sort(),
      [api.seeded.statements.housingBudget, api.seeded.statements.housingPermits].sort());

    const nothing = await api.json<SearchResults>(`/api/v1/search?q=${encodeURIComponent('מונחשאיננובקורפוס')}`);
    assert.deepEqual(nothing.hits, []);
  },
} satisfies Case<ApiContext>;
