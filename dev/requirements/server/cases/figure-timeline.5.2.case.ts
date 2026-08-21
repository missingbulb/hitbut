import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { FigureDetail } from '../../../../src/shared/api.ts';

export default {
  title: 'GET /figures/{id} returns the profile with its statement timeline, newest first',
  async run(api: ApiContext) {
    const detail = await api.json<FigureDetail>(`/api/v1/figures/${encodeURIComponent(api.seeded.figures.ilana)}`);

    assert.equal(detail.figure.id, api.seeded.figures.ilana);
    assert.equal(detail.figure.role, 'חברת הכנסת (דמות לדוגמה)');
    assert.equal(detail.timeline.length, 6);

    const dated = detail.timeline.filter((entry) => entry.statement.saidAt !== undefined).map((entry) => entry.statement.saidAt!);
    assert.deepEqual(dated, [...dated].sort().reverse(), 'dated statements run newest to oldest');
    assert.equal(detail.timeline.at(-1)?.statement.id, api.seeded.statements.undatedCommittee,
      'a statement with no established date sorts after every dated one');

    const flagged = detail.timeline.filter((entry) => entry.flagged).map((entry) => entry.statement.id).sort();
    assert.deepEqual(flagged, [
      api.seeded.statements.housingBudget,
      api.seeded.statements.housingPermits,
      api.seeded.statements.lightRailDenial,
      api.seeded.statements.lightRailPledge,
    ].sort(), 'exactly the statements a live surfaced judgment names are marked');

    const entry = detail.timeline.find((item) => item.statement.id === api.seeded.statements.lightRailPledge);
    assert.equal(entry?.source.publisher, 'ארכיון פרוטוקולים לדוגמה', 'every entry carries the source it came from');
  },
} satisfies Case<ApiContext>;
