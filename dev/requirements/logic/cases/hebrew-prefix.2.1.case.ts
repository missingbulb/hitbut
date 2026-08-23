import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withSearchable } from '../../shared/fixtures.ts';

export default {
  title: 'a search for a Hebrew word reaches statements that wrote it with a prefix',
  async run() {
    const corpus = emptyCorpus();
    const prefixed = await withSearchable(corpus, 'הדיון בכנסת על התקציב נדחה שוב.', 'prefixed');
    const bare = await withSearchable(corpus, 'הכנסת דנה בהצעה בשבוע שעבר.', 'bare');

    const found = async (query: string) => (await corpus.searchUtterances(query)).utterances.map((s) => s.id).sort();

    assert.deepEqual(await found('כנסת'), [prefixed.id, bare.id].sort(), 'the bare word reaches both');
    assert.deepEqual(await found('בכנסת'), [prefixed.id, bare.id].sort(), 'and so does the word with the prefix attached');
    assert.deepEqual(await found('שבכנסת'), [prefixed.id, bare.id].sort(), 'including two stacked clitics');
    assert.deepEqual(await found('תקציב'), [prefixed.id], 'a word only one of them uses still narrows');
  },
} satisfies Case<void>;
