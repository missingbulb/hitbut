import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';

export default {
  title: 'every response carries open CORS headers',
  async run(api: ApiContext) {
    // The corpus is public and researchers read it from their own pages, so this is a
    // decision rather than an oversight — including on the error paths.
    for (const path of ['/api/v1/figures', '/api/v1/inconsistencies', '/api/v1/nope']) {
      const response = await api.get(path);
      assert.equal(response.headers.get('access-control-allow-origin'), '*', `missing on ${path}`);
    }

    const preflight = await api.request('/api/v1/figures', { method: 'OPTIONS' });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
    assert.equal(preflight.headers.get('access-control-allow-methods'), 'GET, OPTIONS');
  },
} satisfies Case<ApiContext>;
