import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { UtteranceDetail } from '../../../../src/shared/api.ts';

export default {
  title: 'GET /utterances/{id} returns what was said, where, and every document that reported it',
  async run(api: ApiContext) {
    const detail = await api.json<UtteranceDetail>(`/api/v1/utterances/${api.seeded.utterances.lightRailPledge}`);

    assert.equal(detail.utterance.text, 'לא אצביע בעד תקציב שגורע ולו שקל אחד מהרכבת הקלה.');
    assert.deepEqual(detail.utterance.saidAt, { value: '2024-03-12', precision: 'day' });
    assert.equal(detail.utterance.venue, 'plenary', 'where it was said travels with the speech act');
    assert.equal(detail.utterance.audience, 'parliament');
    assert.equal(detail.figure.id, api.seeded.figures.ilana);

    // Three outlets carried one speech. Every one of them is reachable: the claim is
    // checkable only against all of the documents behind it, not the first one we fetched.
    assert.equal(detail.attestations.length, 3);
    assert.equal(new Set(detail.attestations.map((a) => a.source.id)).size, 3, 'each from its own source');

    // One of them trimmed it. The utterance keeps the fullest wording; the attestation
    // keeps what that document actually printed, because the difference is an editorial
    // decision a reader is entitled to see.
    const trimmed = detail.attestations.map((a) => a.attestation.text).filter((text) => text !== detail.utterance.text);
    assert.deepEqual(trimmed, ['לא אצביע בעד תקציב שגורע מהרכבת הקלה.']);

    assert.equal(detail.subject?.label, 'הרכבת הקלה');

    // A date established only to the month stays a month on the wire.
    const monthly = await api.json<UtteranceDetail>(`/api/v1/utterances/${api.seeded.utterances.rally}`);
    assert.deepEqual(monthly.utterance.saidAt, { value: '2025-04', precision: 'month' });

    // And no date at all is an absent key, never a null and never a stand-in.
    const undated = await api.json<UtteranceDetail>(`/api/v1/utterances/${api.seeded.utterances.undatedCommittee}`);
    assert.equal('saidAt' in undated.utterance, false);
  },
} satisfies Case<ApiContext>;
