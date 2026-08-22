import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withFigure } from '../../shared/fixtures.ts';

export default {
  title: 'a withdrawn figure leaves the listings and still resolves by id',
  async run() {
    const corpus = emptyCorpus();
    const kept = await withFigure(corpus, 'דמות ראשונה לדוגמה', 'דמות לדוגמה');
    const withdrawn = await withFigure(corpus, 'דמות שנייה לדוגמה', 'דמות לדוגמה');

    await corpus.retireFigure(withdrawn.id);

    const listed = await corpus.listFigures();
    assert.deepEqual(listed.figures.map((figure) => figure.id), [kept.id], 'a retired figure is not listed');

    const resolved = await corpus.getFigure(withdrawn.id);
    assert.equal(resolved?.id, withdrawn.id, 'an old citation must not become a 404');
    assert.equal(resolved?.status, 'retired', 'it degrades to "this record was withdrawn"');
  },
} satisfies Case<void>;
