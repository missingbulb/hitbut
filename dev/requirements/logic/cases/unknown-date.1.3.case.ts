import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withFigure, withUtterance } from '../../shared/fixtures.ts';
import { toWireUtterance } from '../../../../src/shared/api.ts';

export default {
  title: 'an utterance no source dates stores no date, and omits it on the wire',
  async run() {
    const corpus = emptyCorpus();
    const figure = await withFigure(corpus, 'דמות לדוגמה');

    // The archive page carries no date at all. Three stages, one meaning: the column is
    // null, the API omits the key rather than sending a default, and the site renders
    // "תאריך לא ידוע".
    const undated = await withUtterance(corpus, figure.id, 'עמוד ארכיון בלי תאריך.', {
      key: 'undated', saidAt: null,
    });

    const stored = await corpus.getUtterance(undated.id);
    assert.equal(stored?.saidAt, null, 'unknown is its own state: not today, not the epoch, not the fetch time');

    const wire = toWireUtterance(stored!);
    assert.equal('saidAt' in wire, false, 'the key is absent rather than null, so no consumer can default it');
    assert.equal(JSON.parse(JSON.stringify(wire)).saidAt, undefined);

    // A date the source does establish still travels, with the precision it was given.
    const dated = await withUtterance(corpus, figure.id, 'אמירה עם תאריך.', {
      key: 'dated', saidAt: { value: '2026-03-04', precision: 'day' },
    });
    assert.deepEqual(toWireUtterance((await corpus.getUtterance(dated.id))!).saidAt, {
      value: '2026-03-04', precision: 'day',
    });

    // And the undated one sorts after every dated one rather than among them, because a
    // date nobody established cannot put it anywhere in time.
    assert.deepEqual(
      (await corpus.utteranceTimeline(figure.id)).map((utterance) => utterance.id),
      [dated.id, undated.id],
    );
  },
} satisfies Case<void>;
