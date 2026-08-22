import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withSource } from '../../shared/fixtures.ts';
import { readSourceDate, sortableInstant } from '../../../../src/backend/corpus/dates.ts';

export default {
  title: 'a date established only to the month is a month — not a day, and not unknown',
  async run() {
    assert.deepEqual(readSourceDate('1998-03-12'), { value: '1998-03-12', precision: 'day' });
    assert.deepEqual(readSourceDate('1998-03'), { value: '1998-03', precision: 'month' });
    assert.deepEqual(readSourceDate('1998'), { value: '1998', precision: 'year' });
    assert.equal(readSourceDate(null), null, 'no date is its own state');
    assert.equal(readSourceDate('sometime in the spring'), null, 'and so is one we cannot read');

    const corpus = emptyCorpus();
    const figure = await corpus.ensureFigure({ displayName: 'דמות לדוגמה', role: 'דמות לדוגמה' });
    const record = async (text: string, raw: string | null, key: string) =>
      (await corpus.recordReported({
        figureId: figure.id, text, language: 'he', saidAt: readSourceDate(raw),
        venue: 'op-ed', sourceId: (await withSource(corpus, 'העיתון לדוגמה', key)).id,
      })).utterance;

    const month = await record('אמירה מהארכיון, מתוארכת לחודש בלבד.', '1998-03', 'archive-month');
    const day = await record('אמירה מתוארכת ליום.', '1998-03-12', 'archive-day');
    const unknown = await record('אמירה בלי תאריך כלל.', null, 'archive-undated');

    // Three states, and they survive the round trip through storage as three.
    assert.deepEqual((await corpus.getUtterance(month.id))?.saidAt, { value: '1998-03', precision: 'month' });
    assert.deepEqual((await corpus.getUtterance(day.id))?.saidAt, { value: '1998-03-12', precision: 'day' });
    assert.equal((await corpus.getUtterance(unknown.id))?.saidAt, null);

    // Sorting needs an instant, but inventing one is a read-time concern and never stored.
    assert.equal(sortableInstant(month.saidAt), '1998-03-01');
    assert.equal((await corpus.getUtterance(month.id))?.saidAt?.value, '1998-03', 'the stored value is untouched');
    assert.equal(sortableInstant(null), null);
  },
} satisfies Case<void>;
