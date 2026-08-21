import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { InconsistencySummary, Page } from '../../../../src/shared/api.ts';

export default {
  title: 'GET /inconsistencies returns surfaced records only, newest first',
  async run(api: ApiContext) {
    const page = await api.json<Page<InconsistencySummary>>('/api/v1/inconsistencies');
    const ids = page.items.map((item) => item.judgment.id);

    assert.deepEqual(ids, [api.seeded.judgments.lightRail, api.seeded.judgments.housing, api.seeded.judgments.budget],
      'newest first');
    assert.equal(ids.includes(api.seeded.judgments.consistent), false, 'a consistent pair is not an inconsistency');
    assert.equal(ids.includes(api.seeded.judgments.lightRailOld), false, 'and a superseded judgment has left the list');

    const first = page.items[0];
    assert.equal(first.judgment.kind, 'contradiction');
    assert.equal(first.figure.id, api.seeded.figures.ilana);
    assert.equal(first.earlier.id, api.seeded.statements.lightRailPledge);
    assert.equal(first.later.id, api.seeded.statements.lightRailDenial);

    const mine = await api.json<Page<InconsistencySummary>>(`/api/v1/inconsistencies?figure=${encodeURIComponent(api.seeded.figures.doron)}`);
    assert.deepEqual(mine.items.map((item) => item.judgment.id), [api.seeded.judgments.budget]);
  },
} satisfies Case<ApiContext>;
