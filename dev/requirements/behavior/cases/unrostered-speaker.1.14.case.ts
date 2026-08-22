import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { acquisitionWorld, payloadOf } from '../../shared/acquisition-harness.ts';
import { runAcquisition } from '../../../../src/backend/acquisition/run.ts';

// A committee protocol as it actually reads: the member we track, and then a witness, a
// petitioner and a clerk. Under the old behaviour each of the last three got a slug, a
// page, a timeline and eventually an inconsistency flag.
const PROTOCOL = payloadOf([
  ['דמות לדוגמה', '2026-02-02', 'תקציב', 'אנחנו נדון בסעיף התקציב הזה עד שיהיה ברור.'],
  ['עד לדוגמה', '2026-02-02', 'תקציב', 'אני מבקש להעיר שהנתון שהוצג אינו מדויק.'],
  ['עותרת לדוגמה', '2026-02-02', 'תקציב', 'הגשנו את העתירה לפני שנתיים.'],
  ['רשמת לדוגמה', '2026-02-02', 'תקציב', 'הישיבה ננעלה בשעה 14:20.'],
]);

export default {
  title: 'a speaker who is not on the roster does not become a tracked figure',
  async run() {
    const world = await acquisitionWorld([
      { key: 'protocol-1', url: 'https://example.org/protocols/1', payload: PROTOCOL },
    ]);
    const before = (await world.corpus.listFigures()).figures.map((figure) => figure.id).sort();

    const [outcome] = await runAcquisition(world.options);

    const after = (await world.corpus.listFigures()).figures.map((figure) => figure.id).sort();
    assert.deepEqual(after, before, 'a crawl must not add anybody to the roster');

    assert.equal(outcome?.statements, 1, 'only the speaker we track produced a statement');
    assert.equal(outcome?.unattributed, 3, 'and the other three are held, not dropped');

    // None of them resolves as a figure, by name or by slug.
    for (const name of ['עד לדוגמה', 'עותרת לדוגמה', 'רשמת לדוגמה']) {
      assert.equal(
        await world.corpus.resolveSpeaker(world.options.roster, name),
        null,
        `${name} appeared in a document and must still be nobody we track`,
      );
    }

    // And nothing was handed to analysis on their behalf: the one queued message is the
    // tracked speaker's, so no unrostered person can reach an inconsistency flag.
    assert.equal(world.queue.sent.length, 1);
  },
} satisfies Case<void>;
