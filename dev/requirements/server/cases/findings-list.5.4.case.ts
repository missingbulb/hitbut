import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { FindingSummary, Page } from '../../../../src/shared/api.ts';

export default {
  title: 'GET /findings returns live surfaced findings only, newest first',
  async run(api: ApiContext) {
    const page = await api.json<Page<FindingSummary>>('/api/v1/findings');
    const ids = page.items.map((item) => item.finding.id);

    assert.ok(ids.includes(api.seeded.findings.budgetChange), 'the live trend change is listed');
    assert.ok(ids.includes(api.seeded.findings.rallyAnomaly), 'so is the live anomaly');
    assert.ok(
      !ids.includes(api.seeded.findings.supersededChange),
      'a superseded finding is not shown — it is kept because people linked to it, not because it is current',
    );

    assert.deepEqual(ids, [...ids].sort().reverse(), 'newest first, by the ULID that sorts by mint order');

    // Every listed finding arrives with the utterances it rests on already resolved, so a
    // reader never sees a claim they cannot check.
    for (const item of page.items) {
      assert.ok(item.restsOn.length > 0, `${item.finding.id} was listed with nothing to check it against`);
      for (const rests of item.restsOn) {
        assert.ok(rests.utterance.text.length > 0);
        assert.ok(rests.attestations.length > 0, 'and each of those has at least one document behind it');
      }
    }

    // An anomaly carries the room; a trend change carries the interval. Neither carries
    // the other's, and the listing is where that is first visible.
    const anomaly = page.items.find((item) => item.finding.kind === 'anomaly');
    assert.equal(anomaly?.finding.venue, 'rally');
    assert.equal(anomaly?.finding.changed, null);
    const change = page.items.find((item) => item.finding.id === api.seeded.findings.budgetChange);
    assert.deepEqual(change?.finding.changed, { after: '2025-11-05', before: '2026-04-02' });
    assert.equal(change?.finding.venue, null);

    const mine = await api.json<Page<FindingSummary>>(`/api/v1/findings?figure=${encodeURIComponent(api.seeded.figures.doron)}`);
    assert.deepEqual(mine.items.map((item) => item.figure.id), [api.seeded.figures.doron]);
  },
} satisfies Case<ApiContext>;
