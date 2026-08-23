import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { StatusView } from '../../../../src/shared/api.ts';

export default {
  title: 'status returns the corpus totals, with no credential',
  async run(api: ApiContext) {
    const response = await api.get('/api/v1/status');
    // No Authorization header was sent. Every number below is reachable by walking the
    // public corpus API, so asking for one here would protect nothing.
    assert.equal(response.status, 200);

    const status = (await response.json()) as StatusView;
    assert.equal(
      status.totals.figures,
      Object.keys(api.seeded.figures).length,
      'the roster the fixture syncs is the population the totals count',
    );
    assert.ok(status.totals.utterances > 0, 'the seeded corpus has utterances and the totals say none');
    // More documents than utterances, because the fixture has one speech three outlets carried.
    assert.ok(
      status.totals.attestations > status.totals.utterances,
      `${status.totals.attestations} attestations for ${status.totals.utterances} utterances — the merge is not being counted`,
    );
    assert.ok(status.readAt.endsWith('Z'), `readAt should be an instant, got ${status.readAt}`);
  },
} satisfies Case<ApiContext>;
