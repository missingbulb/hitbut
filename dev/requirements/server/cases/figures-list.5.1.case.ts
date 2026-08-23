import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { FigureSummary, Page } from '../../../../src/shared/api.ts';

export default {
  title: 'GET /figures lists figures, and its cursor returns the next page without repeats',
  async run(api: ApiContext) {
    const all = await api.json<Page<FigureSummary>>('/api/v1/figures');
    assert.equal(all.items.length, 3);
    assert.equal(all.nextCursor, null, 'a page that fits carries no cursor');

    const summary = all.items.find((figure) => figure.id === api.seeded.figures.ilana);
    assert.ok(summary, 'the seeded figure is listed');
    assert.equal(summary.displayName, 'אילנה מורג־עציון');
    assert.equal(summary.utteranceCount, 6);
    assert.equal(summary.flaggedCount, 3, 'the anomaly rests on one, the housing change on two');
    assert.deepEqual(
      summary.subjects.map((subject) => subject.label).sort(),
      ['הרכבת הקלה', 'מצוקת הדיור'],
      'the subjects this persona has spoken on, named where the corpus has named them',
    );

    const first = await api.json<Page<FigureSummary>>('/api/v1/figures?limit=2');
    assert.equal(first.items.length, 2);
    assert.ok(first.nextCursor);
    const second = await api.json<Page<FigureSummary>>(`/api/v1/figures?limit=2&cursor=${encodeURIComponent(first.nextCursor!)}`);
    assert.equal(second.items.length, 1);
    const seen = [...first.items, ...second.items].map((figure) => figure.id);
    assert.equal(new Set(seen).size, seen.length, 'no figure appears on both pages');
    assert.deepEqual(seen.sort(), all.items.map((figure) => figure.id).sort(), 'and none is skipped between them');
  },
} satisfies Case<ApiContext>;
