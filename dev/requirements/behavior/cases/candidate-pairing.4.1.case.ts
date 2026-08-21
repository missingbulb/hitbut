import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { seededCorpus } from '../../shared/fixtures.ts';
import { ScriptedJudge } from '../../shared/fakes.ts';
import { analyzeStatement } from '../../../../src/backend/analysis/run.ts';

export default {
  title: 'pairs are drawn only from one figure’s own statements, and only where topics overlap',
  async run() {
    const { corpus, statements } = await seededCorpus();
    const judge = new ScriptedJudge(() => ({ kind: 'consistent', score: 0.1, rationale: '' }), { model: 'test/judge-2' });

    await analyzeStatement({ corpus, judge, surfacingThreshold: 0.7 }, statements.housingPermits);

    // Two figures disagreeing is not an inconsistency, and one figure's unrelated
    // statements are not a pair worth paying a model to read.
    assert.deepEqual(
      judge.asked.map((request) => [request.earlier.id, request.later.id]),
      [[statements.housingBudget, statements.housingPermits]],
      'only the other statement on the same topic by the same figure was compared',
    );
    for (const request of judge.asked) {
      assert.equal(request.earlier.figureId, request.later.figureId);
      assert.ok(request.earlier.topics.some((topic) => request.later.topics.includes(topic)));
    }
    // The light-rail statements are the same figure but a different topic; the budget
    // statements share a topic word but belong to someone else.
    const asked = judge.asked.flatMap((request) => [request.earlier.id, request.later.id]);
    assert.equal(asked.includes(statements.lightRailPledge), false);
    assert.equal(asked.includes(statements.knessetBudgetDelay), false);
  },
} satisfies Case<void>;
