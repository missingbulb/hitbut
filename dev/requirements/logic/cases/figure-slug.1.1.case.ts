import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus } from '../../shared/fixtures.ts';
import { mintFigureId } from '../../../../src/backend/corpus/ids.ts';
import type { RosterEntry } from '../../../../src/backend/corpus/roster.ts';

const ENTRY: RosterEntry = {
  id: 'אילנה-מורג',
  displayName: 'אילנה מורג',
  role: 'חברת הכנסת (דמות לדוגמה)',
  aliases: [],
  qualifies: 'דמות לדוגמה: נבחרת ציבור מכהנת.',
  coverage: [{ sourceModule: 'sample-protocols', from: '2023-01-01' }],
  status: 'active',
};

export default {
  title: 'a figure keeps its slug when its display name changes',
  async run() {
    const corpus = emptyCorpus();

    // The slug is minted once, when the roster entry is authored — which is what
    // `roster-add` does — and reads as the name, in the name's own script. Transliterating
    // without vowels is a guess, and a guess baked into a permanent id is a guess forever.
    assert.equal(mintFigureId(ENTRY.displayName, []), ENTRY.id);

    const [figure] = await corpus.syncRoster([ENTRY]);
    assert.equal(figure?.id, ENTRY.id);

    // A rename in the roster is an edit to the same entry, so the citation does not move.
    await corpus.syncRoster([{ ...ENTRY, displayName: 'אילנה מורג־עציון' }]);

    const renamed = await corpus.getFigure(ENTRY.id);
    assert.equal(renamed?.displayName, 'אילנה מורג־עציון');
    assert.equal(renamed?.id, ENTRY.id, 'the id is a citation: a rename must not move it');
    assert.equal((await corpus.listFigures()).figures.length, 1, 'and must not mint a second person');

    // Two people who happen to share a name get two ids; neither takes the other's.
    assert.equal(mintFigureId('אילנה מורג', [ENTRY.id]), 'אילנה-מורג-2');
  },
} satisfies Case<void>;
