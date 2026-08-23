import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withSearchable } from '../../shared/fixtures.ts';

export default {
  title: 'niqqud, geresh and gershayim are folded away on both sides of the search',
  async run() {
    const corpus = emptyCorpus();
    // An acronym as a formal transcript writes it, and a vocalised word as it appears in
    // a ceremonial text — neither is how anyone types a query.
    const acronym = await withSearchable(corpus, 'מנכ״ל המשרד הופיע בוועדה.', 'acronym');
    const vocalised = await withSearchable(corpus, 'הוּא אָמַר זֹאת בַּדִּיּוּן.', 'vocalised');

    const found = async (query: string) => (await corpus.searchUtterances(query)).utterances.map((s) => s.id);
    assert.deepEqual(await found('מנכל'), [acronym.id], 'the acronym without its gershayim finds it');
    assert.deepEqual(await found('מנכ״ל'), [acronym.id], 'and so does the acronym with them');
    assert.deepEqual(await found('בדיון'), [vocalised.id], 'an unvocalised query meets a vocalised quote');
  },
} satisfies Case<void>;
