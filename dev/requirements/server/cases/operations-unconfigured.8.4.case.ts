import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { ErrorBody } from '../../../../src/shared/api.ts';

export default {
  title: 'operations refuses when no credential is configured, rather than answering openly',
  async run(api: ApiContext) {
    // This lane runs the shipped Worker from the committed wrangler.toml, where
    // DASHBOARD_TOKEN is genuinely unset — a secret is not in the config file. So this is
    // the real deployed shape of a Worker whose secret was never added, which is exactly
    // the deploy nobody re-checks.
    const response = await api.get('/api/v1/operations');
    assert.equal(response.status, 503, 'an unguarded operations route is a route with no guard');

    const body = (await response.json()) as ErrorBody;
    assert.equal(body.error.code, 'operations_unconfigured');
    // It has to say which of the two it is: "refused" and "not set up" send whoever is
    // looking to completely different places.
    assert.match(body.error.message, /DASHBOARD_TOKEN/);

    // And presenting a token does not talk it round: there is nothing to compare against.
    const offered = await api.request('/api/v1/operations', { headers: { authorization: 'Bearer anything-at-all' } });
    assert.equal(offered.status, 503);
  },
} satisfies Case<ApiContext>;
