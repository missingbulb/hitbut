import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { ErrorBody } from '../../../../src/shared/api.ts';

export default {
  title: 'an unknown figure answers 404, never an empty 200',
  async run(api: ApiContext) {
    // An empty 200 turns a typo into "this person has said nothing", which is the most
    // defamatory thing an empty page could imply here.
    const missing = await api.get(`/api/v1/figures/${encodeURIComponent('אין-כזו-דמות')}`);
    assert.equal(missing.status, 404);
    assert.equal(((await missing.json()) as ErrorBody).error.code, 'no_such_figure');

    const noStatement = await api.get('/api/v1/statements/01JZZZZZZZZZZZZZZZZZZZZZZZ');
    assert.equal(noStatement.status, 404);
    assert.equal(((await noStatement.json()) as ErrorBody).error.code, 'no_such_statement');

    const noJudgment = await api.get('/api/v1/inconsistencies/01JZZZZZZZZZZZZZZZZZZZZZZZ');
    assert.equal(noJudgment.status, 404);
    assert.equal(((await noJudgment.json()) as ErrorBody).error.code, 'no_such_inconsistency');

    // And a figure that does exist still answers.
    assert.equal((await api.get(`/api/v1/figures/${encodeURIComponent(api.seeded.figures.neta)}`)).status, 200);
  },
} satisfies Case<ApiContext>;
