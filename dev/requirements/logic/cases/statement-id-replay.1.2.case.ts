import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, REFERENCE_NOW } from '../../shared/fixtures.ts';

export default {
  title: 'replaying an extractor over the same payload reuses the statement ids',
  async run() {
    const corpus = emptyCorpus();
    const figure = await corpus.ensureFigure({ displayName: 'דמות לדוגמה', role: 'דמות לדוגמה' });
    const source = await corpus.recordSource({
      url: 'https://example.org/protocols/1', publisher: 'ארכיון פרוטוקולים לדוגמה', kind: 'transcript',
      fetchedAt: REFERENCE_NOW, rawKey: 'sample/1.raw', extraction: 'extracted',
      sourceModule: 'sample-protocols', externalKey: 'protocol-1',
    });
    const extracted = [0, 1].map((ordinal) => ({
      ordinal, figureId: figure.id, quote: `ציטוט מספר ${ordinal}`, language: 'he' as const,
      saidAt: '2026-01-01', context: null, topics: ['תקציב'],
    }));

    const first = await corpus.saveStatements(source.id, extracted);

    // A parser fix, replayed over the cached payload: better text, same statements.
    const second = await corpus.saveStatements(source.id, [
      { ...extracted[0], quote: 'ציטוט מספר 0, עכשיו עם הפיסוק הנכון.' },
      extracted[1],
    ]);

    assert.deepEqual(second.map((statement) => statement.id), first.map((statement) => statement.id));
    const reread = await corpus.getStatement(first[0].id);
    assert.equal(reread?.quote, 'ציטוט מספר 0, עכשיו עם הפיסוק הנכון.', 'the text updates under the id it already had');
  },
} satisfies Case<void>;
