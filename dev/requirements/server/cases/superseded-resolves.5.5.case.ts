import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { InconsistencyDetail } from '../../../../src/shared/api.ts';

export default {
  title: 'GET /inconsistencies/{id} resolves a superseded record and names what replaced it',
  async run(api: ApiContext) {
    const response = await api.get(`/api/v1/inconsistencies/${api.seeded.judgments.lightRailOld}`);
    assert.equal(response.status, 200, 'a citation of a superseded judgment must not become a 404');

    const detail = (await response.json()) as InconsistencyDetail;
    assert.equal(detail.judgment.id, api.seeded.judgments.lightRailOld);
    assert.equal(detail.judgment.score, 0.71, 'it still says exactly what it said');
    assert.equal(detail.judgment.modelVersion, 'sample/judge-0', 'and which model said it');
    assert.equal(detail.supersededBy?.id, api.seeded.judgments.lightRail, 'and points forward at its replacement');

    const live = await api.json<InconsistencyDetail>(`/api/v1/inconsistencies/${api.seeded.judgments.lightRail}`);
    assert.equal(live.supersededBy, null);
    assert.equal(live.earlierSource.publisher, 'ארכיון פרוטוקולים לדוגמה');
    assert.equal(live.laterSource.publisher, 'ערוץ החדשות לדוגמה');
    assert.ok(live.judgment.rationale.length > 0, 'the rationale travels with the record');
  },
} satisfies Case<ApiContext>;
