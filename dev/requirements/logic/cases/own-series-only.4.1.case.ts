import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withFigure, withSeries, withUtterance } from '../../shared/fixtures.ts';
import { detect } from '../../../../src/backend/detection/run.ts';

export default {
  title: 'detection reads one persona’s own series and never compares them with anybody else’s',
  async run() {
    const corpus = emptyCorpus();

    // One persona holds a position throughout. Another says the opposite of it, on the same
    // subject, at the same time. That is two people disagreeing — which is public life, not
    // an inconsistency, and the product must not report it as one.
    const { figure, clusterId, versions } = await withSeries(corpus, [
      { position: 0.8 }, { position: 0.75 }, { position: 0.85 }, { position: 0.8 }, { position: 0.78 },
    ]);

    const other = await withFigure(corpus, 'דמות אחרת לדוגמה');
    for (const [index, position] of [-0.9, -0.85, -0.8, -0.9].entries()) {
      const utterance = await withUtterance(corpus, other.id, `עמדה נגדית מספר ${index + 1}.`, { key: `other-${index}` });
      await corpus.assignToCluster(utterance.id, clusterId, 0.05);
      await corpus.recordStance({ utteranceId: utterance.id, clusterId, position, confidence: 0.8, ...versions });
    }

    // Both personas are in the same subject, and their positions are as far apart as the
    // axis allows. Neither produces a finding, because neither has moved.
    const mine = await detect({ corpus, versions, surfacingThreshold: 0.5 }, figure.id, clusterId);
    assert.deepEqual(mine, [], 'a persona who has been consistent stays consistent when somebody else disagrees');

    const theirs = await detect({ corpus, versions, surfacingThreshold: 0.5 }, other.id, clusterId);
    assert.deepEqual(theirs, [], 'and the disagreement is not the other persona’s finding either');

    // The series a detector reads carries only that persona's utterances — nine sit in this
    // subject, and each pass sees its own five or four.
    const series = await corpus.stanceSeries(figure.id, clusterId, versions);
    assert.equal(series.length, 5);
    assert.deepEqual(
      [...new Set(series.map((point) => point.utterance.figureId))],
      [figure.id],
      'nobody else’s utterance is on it',
    );
    assert.equal((await corpus.clusterMembers(clusterId)).length, 9, 'though the subject holds both personas’ utterances');
  },
} satisfies Case<void>;
