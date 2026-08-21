import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withPair } from '../../shared/fixtures.ts';
import { ScriptedJudge } from '../../shared/fakes.ts';
import { analyzeStatement } from '../../../../src/backend/analysis/run.ts';

export default {
  title: 'a pair the judge calls consistent is stored with its score and never surfaced',
  async run() {
    const corpus = emptyCorpus();
    const pair = await withPair(corpus, 'נעקוב אחרי לוחות הזמנים.', 'הפרויקט מתקדם לפי התכנון.', 'תחבורה');
    const judge = new ScriptedJudge(() => ({ kind: 'consistent', score: 0.18, rationale: 'שתי האמירות יכולות להתקיים יחד.' }));

    const [judgment] = await analyzeStatement({ corpus, judge, surfacingThreshold: 0.7 }, pair.later.id);

    assert.equal(judgment.kind, 'consistent');
    assert.equal(judgment.surfaced, false);
    assert.deepEqual((await corpus.listSurfaced()).judgments, [], 'nothing about this pair reaches the product');

    // Kept, not discarded: the negatives are what make the threshold tunable, and what
    // stops the same pair being paid for twice.
    const stored = await corpus.getJudgment(judgment.id);
    assert.equal(stored?.score, 0.18);
    assert.equal(stored?.rationale, 'שתי האמירות יכולות להתקיים יחד.');
  },
} satisfies Case<void>;
