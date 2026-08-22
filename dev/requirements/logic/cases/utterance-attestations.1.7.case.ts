import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withSource } from '../../shared/fixtures.ts';

const SPOKEN = 'לא אצביע בעד תקציב שגורע ולו שקל אחד מהרכבת הקלה, ואני אומרת את זה בפעם האחרונה.';
// The same sentence as three outlets carried it: different quotation marks, a trimmed
// version, and one that dropped the ellipsis. None of that makes it a different thing said.
const AS_PRINTED = [
  `"${SPOKEN}"`,
  'לא אצביע בעד תקציב שגורע ולו שקל אחד מהרכבת הקלה, ואני אומרת את זה בפעם האחרונה!',
  `«${SPOKEN}»`,
];

export default {
  title: 'one speech reported by three documents is one utterance with three attestations',
  async run() {
    const corpus = emptyCorpus();
    const figure = await corpus.ensureFigure({ displayName: 'דמות לדוגמה', role: 'דמות לדוגמה' });
    const outlets = ['העיתון לדוגמה', 'ערוץ החדשות לדוגמה', 'The Sample Review'];

    const recorded = [];
    for (const [index, printed] of AS_PRINTED.entries()) {
      const source = await withSource(corpus, outlets[index], `report-${index}`);
      recorded.push(
        await corpus.recordReported({
          figureId: figure.id,
          text: printed,
          language: 'he',
          saidAt: { value: '2024-03-12', precision: 'day' },
          venue: 'press-conference',
          sourceId: source.id,
        }),
      );
    }

    const ids = new Set(recorded.map((entry) => entry.utterance.id));
    assert.equal(ids.size, 1, 'three reports of one speech must be one utterance');
    assert.deepEqual(recorded.map((entry) => entry.merged), [false, true, true]);
    assert.equal((await corpus.utterancesFor(figure.id)).length, 1);

    const attestations = await corpus.attestationsFor([...ids][0]);
    assert.equal(attestations.length, 3, 'each document that reported it is its own attestation');
    assert.deepEqual(
      attestations.map((attestation) => attestation.text).sort(),
      [...AS_PRINTED].sort(),
      'and each keeps the wording that document actually printed',
    );

    // The fullest wording wins: a quote trimmed for space must not become the record.
    const utterance = await corpus.getUtterance([...ids][0]);
    assert.equal(utterance?.text.length, Math.max(...AS_PRINTED.map((text) => text.length)));
  },
} satisfies Case<void>;
