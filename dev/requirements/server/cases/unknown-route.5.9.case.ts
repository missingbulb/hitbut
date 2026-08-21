import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { ErrorBody } from '../../../../src/shared/api.ts';

export default {
  title: 'an unknown path answers 404 with the JSON error envelope',
  async run(api: ApiContext) {
    for (const path of ['/api/v1/nope', '/api/v1/figures/a/b/c', '/', '/api/v2/figures']) {
      const response = await api.get(path);
      assert.equal(response.status, 404, `${path} did not 404`);
      assert.match(response.headers.get('content-type') ?? '', /application\/json/, `${path} answered with something else`);
      const body = (await response.json()) as ErrorBody;
      assert.equal(body.error.code, 'not_found');
      assert.match(body.error.message, /no route/);
    }
  },
} satisfies Case<ApiContext>;
