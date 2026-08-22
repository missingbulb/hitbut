import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withFigure, withUtterance } from '../../shared/fixtures.ts';

const EARLY = 'לא אצביע בעד תקציב שגורע ולו שקל אחד מהרכבת הקלה.';
const LATE = 'הרכבת הקלה מעולם לא הייתה בעדיפות שלי.';

export default {
  title: 're-analysis writes a new finding and the superseded one still resolves',
  async run() {
    const corpus = emptyCorpus();
    const figure = await withFigure(corpus, 'דמות לדוגמה');
    const early = await withUtterance(corpus, figure.id, EARLY, {
      key: 'early', saidAt: { value: '2023-05-04', precision: 'day' },
    });
    const late = await withUtterance(corpus, figure.id, LATE, {
      key: 'late', saidAt: { value: '2025-11-19', precision: 'day' },
    });
    const { clusterId } = await corpus.assignToCluster(early.id, null, 0);
    await corpus.assignToCluster(late.id, clusterId, 0.08);

    const restsOn = [
      { utteranceId: early.id, role: 'before' as const },
      { utteranceId: late.id, role: 'after' as const },
    ];
    const changed = { after: '2023-05-04', before: '2025-11-19' };

    const old = await corpus.recordFinding({
      figureId: figure.id, clusterId, kind: 'trend-change',
      rationale: 'המיקום עבר מהתנגדות מוחלטת להסתייגות.', score: 0.66,
      changed, restsOn, modelVersion: 'sample/stance-0', promptVersion: 'find-v1',
    }, 0.5);

    const live = await corpus.recordFinding({
      figureId: figure.id, clusterId, kind: 'trend-change',
      rationale: 'המיקום עבר מהתנגדות מוחלטת לשלילת עדיפות.', score: 0.81,
      changed, restsOn, modelVersion: 'sample/stance-0', promptVersion: 'find-v2',
    }, 0.5);

    const superseded = await corpus.getFinding(old.id);
    assert.equal(superseded?.supersededBy, live.id, 'the older record points forward at what replaced it');
    assert.equal(superseded?.surfaced, false, 'and drops out of what the product shows');
    assert.equal(superseded?.rationale, old.rationale, 'while still saying exactly what it said');
    assert.equal(superseded?.promptVersion, 'find-v1', 'under the prompt that said it');
    assert.equal(superseded?.score, 0.66);

    assert.equal((await corpus.getFinding(live.id))?.supersededBy, null);
    assert.deepEqual(
      (await corpus.findingsFor(figure.id)).map((finding) => finding.id),
      [live.id],
      'exactly one live finding per persona, subject and kind',
    );

    // A finding below the surfacing threshold is kept and simply not shown — the threshold
    // stays tunable without re-paying for the analysis.
    const quiet = await corpus.recordFinding({
      figureId: figure.id, clusterId, kind: 'anomaly',
      rationale: 'סטייה קלה, מתחת לסף.', score: 0.2, venue: 'rally',
      restsOn: [{ utteranceId: late.id, role: 'deviating' }],
      modelVersion: 'sample/stance-0', promptVersion: 'find-v2',
    }, 0.5);
    assert.equal(quiet.surfaced, false);
    assert.equal((await corpus.getFinding(quiet.id))?.score, 0.2, 'retained, with what it found');
  },
} satisfies Case<void>;
