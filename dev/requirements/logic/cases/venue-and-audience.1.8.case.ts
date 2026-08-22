import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withSource } from '../../shared/fixtures.ts';

const WORDS = 'התקציב הזה לא ייגע בקו הזה.';

export default {
  title: 'venue and audience belong to the utterance, and who reported it to the attestation',
  async run() {
    const corpus = emptyCorpus();
    const figure = await corpus.ensureFigure({ displayName: 'דמות לדוגמה', role: 'דמות לדוגמה' });

    // The same words, the same day, two rooms. That is two utterances — and the difference
    // between the rooms is the whole point of an anomaly, so merging them would erase the
    // finding before anything could look for it.
    const committee = await corpus.recordReported({
      figureId: figure.id, text: WORDS, language: 'he',
      saidAt: { value: '2025-05-04', precision: 'day' },
      venue: 'committee', audience: 'parliament',
      sourceId: (await withSource(corpus, 'ארכיון פרוטוקולים לדוגמה', 'protocol')).id,
    });
    const rally = await corpus.recordReported({
      figureId: figure.id, text: WORDS, language: 'he',
      saidAt: { value: '2025-05-04', precision: 'day' },
      venue: 'rally', audience: 'party-members',
      sourceId: (await withSource(corpus, 'ערוץ החדשות לדוגמה', 'broadcast')).id,
    });

    assert.notEqual(committee.utterance.id, rally.utterance.id, 'same words, different room, different utterance');
    assert.equal(committee.utterance.venue, 'committee');
    assert.equal(committee.utterance.audience, 'parliament');
    assert.equal(rally.utterance.venue, 'rally');
    assert.equal(rally.utterance.audience, 'party-members');

    // A source that does not establish who was being addressed leaves it unknown, not guessed.
    const written = await corpus.recordReported({
      figureId: figure.id, text: 'הודעה קצרה לדוגמה.', language: 'he', saidAt: null,
      venue: 'written-statement',
      sourceId: (await withSource(corpus, 'העיתון לדוגמה', 'release')).id,
    });
    assert.equal(written.utterance.audience, null);

    // And the publication is the attestation's business, not the utterance's.
    const reporters = await corpus.attestationsFor(committee.utterance.id);
    assert.equal(reporters.length, 1);
    assert.equal((await corpus.getSource(reporters[0].sourceId))?.publisher, 'ארכיון פרוטוקולים לדוגמה');
  },
} satisfies Case<void>;
