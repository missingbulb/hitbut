import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { FigureRecord, FigureSummary, Page } from '../../../../src/shared/api.ts';

export default {
  title: 'GET /figures/{id} carries what the record covers and the test the person meets',
  async run(api: ApiContext) {
    const detail = await api.json<FigureRecord>(`/api/v1/figures/${encodeURIComponent(api.seeded.figures.ilana)}`);

    // What put this person on the roster. Held privately it is a preference, not a rule.
    assert.equal(typeof detail.figure.qualifies, 'string');
    assert.ok((detail.figure.qualifies ?? '').trim().length > 0, 'every tracked figure states its test');

    // What the record actually reaches. Without it, a thin timeline reads as a thin record.
    assert.ok(Array.isArray(detail.figure.coverage), 'coverage is a list, not a sentence to parse');
    assert.deepEqual(detail.figure.coverage, [{ sourceModule: 'sample-protocols', from: '2023-01-01' }]);

    // Both travel on the listing too, because the methodology page publishes the roster
    // from it rather than fetching every figure to assemble the same sentence.
    const listing = await api.json<Page<FigureSummary>>('/api/v1/figures');
    for (const figure of listing.items) {
      assert.ok((figure.qualifies ?? '').trim().length > 0, `${figure.id} reached the wire with no stated test`);
      assert.ok(figure.coverage && figure.coverage.length > 0, `${figure.id} reached the wire with no coverage`);
    }
  },
} satisfies Case<ApiContext>;
