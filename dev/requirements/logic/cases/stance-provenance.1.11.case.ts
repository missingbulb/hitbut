import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withUtterance } from '../../shared/fixtures.ts';

// The pair the design uses to make the point: both sentences are *about* the same thing,
// which is exactly why an embedding puts them together and exactly why distance alone
// cannot tell you they conflict. The positions below are what a judging model said, and
// the case is about that judgment being recorded with its provenance — not about the
// numbers being right.
const REFUSES = 'לא אצביע בעד תקציב שגורע ולו שקל אחד מהרכבת הקלה.';
const DISOWNS = 'הרכבת הקלה מעולם לא הייתה בעדיפות שלי.';

export default {
  title: 'a stance carries the model and prompt that produced it, and a re-run never overwrites one',
  async run() {
    const corpus = emptyCorpus();
    const figure = await corpus.ensureFigure({ displayName: 'דמות לדוגמה', role: 'דמות לדוגמה' });
    const refuses = await withUtterance(corpus, figure.id, REFUSES, { key: 'refuses' });
    const disowns = await withUtterance(corpus, figure.id, DISOWNS, { key: 'disowns' });
    const { clusterId } = await corpus.assignToCluster(refuses.id, null, 0);
    await corpus.assignToCluster(disowns.id, clusterId, 0.08);

    const first = await corpus.recordStance({
      utteranceId: refuses.id, clusterId, position: 0.9, confidence: 0.8,
      modelVersion: 'sample/stance-0', promptVersion: 'stance-v1',
    });

    assert.equal(first.modelVersion, 'sample/stance-0');
    assert.equal(first.promptVersion, 'stance-v1');
    assert.equal(first.position, 0.9, 'a position on the cluster’s own axis, not a distance in embedding space');

    // Same model, same prompt, same utterance: nothing new to say, and nothing new written.
    const again = await corpus.recordStance({
      utteranceId: refuses.id, clusterId, position: 0.9, confidence: 0.8,
      modelVersion: 'sample/stance-0', promptVersion: 'stance-v1',
    });
    assert.equal(again.id, first.id, 'a replay of the same judgment is idempotent');

    // A new prompt re-judges. The earlier judgment stays exactly as it was — a reader who
    // saw it must still be able to see it, and what the older prompt said is evidence about
    // the prompt as much as about the utterance.
    const rejudged = await corpus.recordStance({
      utteranceId: refuses.id, clusterId, position: 0.4, confidence: 0.55,
      modelVersion: 'sample/stance-0', promptVersion: 'stance-v2',
    });

    assert.notEqual(rejudged.id, first.id);
    const kept = await corpus.stancesFor(refuses.id);
    assert.equal(kept.length, 2, 'both judgments are kept');
    assert.deepEqual(kept.map((stance) => stance.position), [0.9, 0.4]);

    // A series is read at one model and prompt, so re-judging under a new prompt cannot
    // produce a series that mixes two of them.
    const v1 = await corpus.stanceSeries(figure.id, clusterId, {
      modelVersion: 'sample/stance-0', promptVersion: 'stance-v1',
    });
    assert.deepEqual(v1.map((point) => point.stance.position), [0.9]);
    assert.equal(v1[0]?.utterance.id, refuses.id, 'the series carries the utterance, not just its id');
  },
} satisfies Case<void>;
