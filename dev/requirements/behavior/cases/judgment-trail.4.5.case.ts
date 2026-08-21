import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withPair } from '../../shared/fixtures.ts';
import { FakeAi, ScriptedJudge } from '../../shared/fakes.ts';
import { analyzeStatement } from '../../../../src/backend/analysis/run.ts';
import { WorkersAiJudge } from '../../../../src/backend/analysis/judge.ts';
import { PROMPT_VERSION } from '../../../../src/backend/analysis/prompt.ts';

export default {
  title: 'every judgment carries both statement ids, the rationale, and the model and prompt version',
  async run() {
    const corpus = emptyCorpus();
    const pair = await withPair(corpus, 'אמירה מוקדמת לדוגמה.', 'אמירה מאוחרת לדוגמה.');
    const judge = new ScriptedJudge(
      () => ({ kind: 'contradiction', score: 0.9, rationale: 'ההנמקה שנשמרת ומוצגת לקורא.' }),
      { model: 'sample/judge-7', prompt: 'inconsistency/v1' },
    );

    const [judgment] = await analyzeStatement({ corpus, judge, surfacingThreshold: 0.7 }, pair.later.id);
    const stored = await corpus.getJudgment(judgment.id);

    // The defensible trail: which two statements were compared, what was said about them,
    // and by which model reading which committed prompt.
    assert.equal(stored?.earlierStatementId, pair.earlier.id);
    assert.equal(stored?.laterStatementId, pair.later.id);
    assert.equal(stored?.rationale, 'ההנמקה שנשמרת ומוצגת לקורא.');
    assert.equal(stored?.modelVersion, 'sample/judge-7');
    assert.equal(stored?.promptVersion, 'inconsistency/v1');
    assert.ok(stored?.createdAt);

    // And the shipped judge reports the version of the prompt it actually sent.
    const real = new WorkersAiJudge(new FakeAi('{"kind":"consistent","score":0.2,"rationale":"ok"}'), 'model/under-test');
    assert.equal(real.promptVersion, PROMPT_VERSION);
    assert.equal((await real.judge({ figure: pair.figure, earlier: pair.earlier, later: pair.later })).kind, 'consistent');
  },
} satisfies Case<void>;
