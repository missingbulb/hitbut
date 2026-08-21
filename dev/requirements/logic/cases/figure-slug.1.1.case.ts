import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus } from '../../shared/fixtures.ts';
import { mintFigureId } from '../../../../src/backend/corpus/ids.ts';

export default {
  title: 'a figure keeps its slug when its display name changes',
  async run() {
    const corpus = emptyCorpus();
    const figure = await corpus.ensureFigure({ displayName: 'אילנה מורג', role: 'חברת הכנסת (דמות לדוגמה)' });
    assert.equal(figure.id, 'אילנה-מורג', 'the slug should read as the name, in the name’s own script');

    await corpus.rename(figure.id, 'אילנה מורג־עציון');

    const renamed = await corpus.getFigure(figure.id);
    assert.equal(renamed?.displayName, 'אילנה מורג־עציון');
    assert.equal(renamed?.id, figure.id, 'the id is a citation: a rename must not move it');

    // Two people who happen to share a name get two ids; neither takes the other's.
    assert.equal(mintFigureId('אילנה מורג', [figure.id]), 'אילנה-מורג-2');
  },
} satisfies Case<void>;
