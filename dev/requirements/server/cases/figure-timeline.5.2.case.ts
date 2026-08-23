import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { FigureRecord } from '../../../../src/shared/api.ts';

export default {
  title: 'GET /figures/{id} returns the profile with its utterance timeline, newest first',
  async run(api: ApiContext) {
    const detail = await api.json<FigureRecord>(`/api/v1/figures/${encodeURIComponent(api.seeded.figures.ilana)}`);

    assert.equal(detail.figure.id, api.seeded.figures.ilana);
    assert.equal(detail.figure.role, 'חברת הכנסת (דמות לדוגמה)');
    assert.equal(detail.timeline.length, 6);

    const dated = detail.timeline
      .filter((entry) => entry.utterance.saidAt !== undefined)
      .map((entry) => entry.utterance.saidAt!.value);
    assert.deepEqual(dated, [...dated].sort().reverse(), 'dated utterances run newest to oldest');
    assert.equal(detail.timeline.at(-1)?.utterance.id, api.seeded.utterances.undatedCommittee,
      'an utterance with no established date sorts after every dated one');

    const flagged = detail.timeline.filter((entry) => entry.flagged).map((entry) => entry.utterance.id).sort();
    assert.deepEqual(
      flagged,
      [api.seeded.utterances.rally, api.seeded.utterances.housingBudget, api.seeded.utterances.housingPermits].sort(),
      'exactly the utterances a live surfaced finding rests on are marked',
    );

    // The count, not one of the sources: naming a single publisher here would make one of
    // three outlets look like the record.
    const entry = detail.timeline.find((item) => item.utterance.id === api.seeded.utterances.lightRailPledge);
    assert.equal(entry?.attestationCount, 3);
  },
} satisfies Case<ApiContext>;
