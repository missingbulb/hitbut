import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { UtteranceSearchResults } from '../../../../src/shared/api.ts';

export default {
  title: 'GET /search answers a Hebrew query whose term carries an attached prefix',
  async run(api: ApiContext) {
    // The logic case proves the folding; this proves the deployed route runs it against
    // the real index rather than against a copy of the rules that drifted.
    const prefixed = await api.json<UtteranceSearchResults>(`/api/v1/search?q=${encodeURIComponent('בכנסת')}`);
    assert.deepEqual(prefixed.hits.map((hit) => hit.utterance.id), [api.seeded.utterances.knessetBudgetDelay]);
    assert.equal(prefixed.query, 'בכנסת');
    assert.equal(prefixed.hits[0].figure.displayName, 'נטע קרליבך', 'a hit carries its speaker');

    const bare = await api.json<UtteranceSearchResults>(`/api/v1/search?q=${encodeURIComponent('כנסת')}`);
    assert.deepEqual(bare.hits.map((hit) => hit.utterance.id), [api.seeded.utterances.knessetBudgetDelay]);

    // One result per thing said, not per document: the light-rail pledge was carried by
    // three outlets, and five rows of one sentence would be the echo the utterance split
    // exists to prevent, arriving through the search box.
    const carried = await api.json<UtteranceSearchResults>(`/api/v1/search?q=${encodeURIComponent('הרכבת')}`);
    const pledge = carried.hits.filter((hit) => hit.utterance.id === api.seeded.utterances.lightRailPledge);
    assert.equal(pledge.length, 1, 'one speech, one result');
    assert.equal(pledge[0]?.attestationCount, 3, 'with the number of documents behind it');

    const nothing = await api.json<UtteranceSearchResults>(`/api/v1/search?q=${encodeURIComponent('מונחשאיננובקורפוס')}`);
    assert.deepEqual(nothing.hits, []);
  },
} satisfies Case<ApiContext>;
