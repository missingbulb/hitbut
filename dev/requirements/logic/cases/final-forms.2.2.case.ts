import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withSearchable } from '../../shared/fixtures.ts';
import { fold } from '../../../../src/shared/text.ts';

export default {
  title: 'final and non-final forms of a letter are one letter to the index and the query',
  async run() {
    assert.equal(fold('ירושלים'), fold('ירושלימ'));
    assert.equal(fold('נדחן'), fold('נדחנ'));

    const corpus = emptyCorpus();
    const utterance = await withSearchable(corpus, 'הישיבה בירושלים נדחתה.');

    const found = async (query: string) => (await corpus.searchUtterances(query)).utterances.map((s) => s.id);
    assert.deepEqual(await found('ירושלים'), [utterance.id]);
    assert.deepEqual(await found('ירושלימ'), [utterance.id], 'a query typed with the wrong form still finds it');
  },
} satisfies Case<void>;
