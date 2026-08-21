import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withStatement } from '../../shared/fixtures.ts';
import { variantsOf } from '../../../../src/shared/text.ts';

export default {
  title: 'a Latin-script query matches Latin text and is untouched by the Hebrew folding',
  async run() {
    // Not every statement in scope is Hebrew, and rules meant for Hebrew clitics must not
    // start stemming English words that happen to begin with the same letters.
    assert.deepEqual(variantsOf('budget'), ['budget']);
    assert.deepEqual(variantsOf('however'), ['however']);

    const corpus = emptyCorpus();
    const { statement: english } = await withStatement(corpus, 'We committed to a dedicated budget line.', { language: 'en' });
    const { statement: hebrew } = await withStatement(corpus, 'הדיון על התקציב נדחה.', { ordinal: 1 });

    const found = async (query: string) => (await corpus.search(query)).statements.map((s) => s.id);
    assert.deepEqual(await found('budget'), [english.id]);
    assert.deepEqual(await found('BUDGET'), [english.id], 'case is folded, as it is for any script');
    assert.deepEqual(await found('תקציב'), [hebrew.id], 'and the two scripts do not reach into each other');
  },
} satisfies Case<void>;
