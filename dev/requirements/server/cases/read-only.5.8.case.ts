import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { ErrorBody } from '../../../../src/shared/api.ts';

export default {
  title: 'a write method is rejected with 405',
  async run(api: ApiContext) {
    // There is no write surface to authenticate — the only writers are the cron trigger
    // and the queue consumer — so the boundary says so rather than implying it by
    // routing failure.
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const response = await api.request('/api/v1/figures', { method, body: method === 'DELETE' ? undefined : '{}' });
      assert.equal(response.status, 405, `${method} was not refused`);
      const body = (await response.json()) as ErrorBody;
      assert.equal(body.error.code, 'method_not_allowed');
      assert.equal(response.headers.get('access-control-allow-origin'), '*');
    }
  },
} satisfies Case<ApiContext>;
