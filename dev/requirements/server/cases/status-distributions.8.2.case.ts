import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { StatusView } from '../../../../src/shared/api.ts';

export default {
  title: 'status distributes utterances over venue and year, and counts the undated separately',
  async run(api: ApiContext) {
    const status = await api.json<StatusView>('/api/v1/status');

    const venueTotal = status.distributions.venue.buckets.reduce((sum, bucket) => sum + bucket.count, 0);
    assert.equal(venueTotal, status.totals.utterances, 'every utterance was said somewhere, so the venue buckets must account for all of them');

    // The one that matters. The fixture holds an utterance no source dated, and 1.3 keeps
    // that null rather than guessing. A year distribution that dropped it would report a
    // smaller corpus than there is; one that filed it under a year would put the guess back.
    assert.ok(status.distributions.year.undated > 0, 'the fixture has an undated utterance and the year distribution says none');
    const yearTotal = status.distributions.year.buckets.reduce((sum, bucket) => sum + bucket.count, 0);
    assert.equal(
      yearTotal + status.distributions.year.undated,
      status.totals.utterances,
      'dated plus undated must be every utterance — anything else means some were dropped',
    );
    assert.ok(
      status.distributions.year.buckets.every((bucket) => /^\d{4}$/.test(bucket.name)),
      'a year bucket must be a year',
    );
  },
} satisfies Case<ApiContext>;
