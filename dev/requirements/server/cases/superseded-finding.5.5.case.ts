import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { FindingDetail } from '../../../../src/shared/api.ts';

export default {
  title: 'GET /findings/{id} resolves a superseded finding and names what superseded it',
  async run(api: ApiContext) {
    // The other half of 1.12: the invariant is only worth anything if the boundary honours
    // it. Somebody cited this id before a better analysis replaced it, and that link has to
    // keep working.
    const superseded = await api.json<FindingDetail>(`/api/v1/findings/${api.seeded.findings.supersededChange}`);

    assert.equal(superseded.finding.id, api.seeded.findings.supersededChange);
    assert.equal(superseded.finding.surfaced, false, 'it is not current');
    assert.equal(superseded.supersededBy?.id, api.seeded.findings.budgetChange, 'and it says what is');
    assert.ok(superseded.finding.rationale.length > 0, 'while still saying exactly what it said');
    assert.equal(superseded.finding.modelVersion, 'sample/stance-0', 'under the model that said it');
    assert.equal(superseded.restsOn.length, 2, 'and still resolves everything it rests on');

    const live = await api.json<FindingDetail>(`/api/v1/findings/${api.seeded.findings.budgetChange}`);
    assert.equal(live.supersededBy, null);
    assert.equal(live.finding.surfaced, true);
  },
} satisfies Case<ApiContext>;
