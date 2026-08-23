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

    const noUtterance = await api.get('/api/v1/utterances/01JZZZZZZZZZZZZZZZZZZZZZZZ');
    assert.equal(noUtterance.status, 404);
    assert.equal(((await noUtterance.json()) as ErrorBody).error.code, 'no_such_utterance');

    const noFinding = await api.get('/api/v1/findings/01JZZZZZZZZZZZZZZZZZZZZZZZ');
    assert.equal(noFinding.status, 404);
    assert.equal(((await noFinding.json()) as ErrorBody).error.code, 'no_such_finding');

    // And a figure that does exist still answers.
    assert.equal((await api.get(`/api/v1/figures/${encodeURIComponent(api.seeded.figures.neta)}`)).status, 200);
  },
} satisfies Case<ApiContext>;
