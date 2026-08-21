import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withPair } from '../../shared/fixtures.ts';
import { ScriptedJudge } from '../../shared/fakes.ts';
import { analyzeStatement } from '../../../../src/backend/analysis/run.ts';

export default {
  title: 'a pair the judge calls contradictory is stored as a contradiction and surfaced',
  async run() {
    const corpus = emptyCorpus();
    const pair = await withPair(
      corpus,
      'לא אצביע בעד תקציב שגורע ולו שקל אחד מהקו הזה.',
      'הקו הזה מעולם לא היה בראש סדר העדיפויות שלי.',
    );
    const judge = new ScriptedJudge(() => ({
      kind: 'contradiction',
      score: 0.94,
      rationale: 'התחייבות בלתי מסויגת, ואחריה הכחשה שהעמדה הזו הייתה קיימת.',
    }));

    const [judgment] = await analyzeStatement({ corpus, judge, surfacingThreshold: 0.7 }, pair.later.id);

    assert.equal(judgment.kind, 'contradiction');
    assert.equal(judgment.earlierStatementId, pair.earlier.id, 'the earlier statement is the one said first');
    assert.equal(judgment.laterStatementId, pair.later.id);
    assert.equal(judgment.surfaced, true);
    assert.deepEqual((await corpus.listSurfaced()).judgments.map((j) => j.id), [judgment.id]);
  },
} satisfies Case<void>;
