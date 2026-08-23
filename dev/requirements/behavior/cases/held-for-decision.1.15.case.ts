import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { acquisitionWorld, payloadOf } from '../../shared/acquisition-harness.ts';
import { runAcquisition, reextract } from '../../../../src/backend/acquisition/run.ts';

// The unrostered speaker sits in the middle deliberately: what the tracked speaker's
// statements are numbered depends on whether the passage above them was skipped or held.
const WITNESS = 'עד לדוגמה';
const PROTOCOL = payloadOf([
  ['דמות לדוגמה', '2026-02-02', 'תקציב', 'פתיחת הדיון בסעיף התקציב.'],
  [WITNESS, '2026-02-02', 'תקציב', 'אני מבקש להעיר שהנתון שהוצג אינו מדויק.'],
  ['דמות לדוגמה', '2026-02-02', 'תקציב', 'נבדוק את ההערה ונחזור אליה.'],
]);

export default {
  title: 'a passage by a speaker we do not track is retained under the name the source gave',
  async run() {
    const world = await acquisitionWorld([
      { key: 'protocol-1', url: 'https://example.org/protocols/1', payload: PROTOCOL },
    ]);
    await runAcquisition(world.options);

    const held = await world.corpus.unattributed();
    assert.equal(held.length, 1, 'the passage is kept — not tracking somebody is not a reason to lose the record');

    const [passage] = held;
    assert.equal(passage?.speakerName, WITNESS, 'under the name the document wrote, never normalized towards a roster name');
    assert.equal(passage?.quote, 'אני מבקש להעיר שהנתון שהוצג אינו מדויק.');
    assert.equal(passage?.ordinal, 1, 'with its position in the payload, which is what a later decision needs');

    // The passages that did resolve keep their place — so if this witness is ever added to
    // the roster, nobody else's citation moves.
    const figure = (await world.corpus.resolveSpeaker(world.options.roster, 'דמות לדוגמה'))!;
    const timeline = await world.corpus.utteranceTimeline(figure.id);
    assert.equal(timeline.length, 2);
    const ids = timeline.map((utterance) => utterance.id);

    // Re-extracting the same payload rewrites the held passage rather than adding a second,
    // and moves none of the resolved ids.
    const sourceId = (await world.corpus.findSource('fixture-source', 'protocol-1'))!.id;
    const again = await reextract(world.options, sourceId);

    assert.equal(again.unattributed, 1);
    assert.equal((await world.corpus.unattributed()).length, 1, 'a replay holds it once, not twice');
    assert.deepEqual(
      (await world.corpus.utteranceTimeline(figure.id)).map((utterance) => utterance.id),
      ids,
      'and the utterances around it keep the ids they were given the first time',
    );

    // Findable by the name a person would search for when deciding about them.
    assert.equal((await world.corpus.unattributed({ speakerName: WITNESS })).length, 1);
  },
} satisfies Case<void>;
