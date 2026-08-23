import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withSearchable } from '../../shared/fixtures.ts';
import { variantsOf } from '../../../../src/shared/text.ts';

export default {
  title: 'a prefix is never stripped down to a stem too short to be a word',
  async run() {
    assert.deepEqual(variantsOf('בית'), ['בית'], 'stripping would leave two letters, so nothing is stripped');
    assert.deepEqual(variantsOf('של'), ['של']);
    assert.deepEqual(variantsOf('בבית'), ['בבית', 'בית'], 'four letters down to three is the shortest strip made');

    const corpus = emptyCorpus();
    const utterance = await withSearchable(corpus, 'הוועדה התכנסה בבית הנבחרים.');

    const found = async (query: string) => (await corpus.searchUtterances(query)).utterances.map((s) => s.id);
    assert.deepEqual(await found('בית'), [utterance.id], 'the three-letter word is still reachable');
    assert.deepEqual(await found('ית'), [], 'and the two-letter fragment reaches nothing');
  },
} satisfies Case<void>;
