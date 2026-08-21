import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withPair } from '../../shared/fixtures.ts';
import { ScriptedJudge } from '../../shared/fakes.ts';
import { analyzeStatement } from '../../../../src/backend/analysis/run.ts';

export default {
  title: 'a pair the judge calls a change of position is stored as a position shift',
  async run() {
    const corpus = emptyCorpus();
    const pair = await withPair(
      corpus,
      'מצוקת הדיור היא בעיה תקציבית.',
      'מצוקת הדיור היא בעיית היתרי בנייה. שיניתי את דעתי.',
      'דיור',
    );
    const judge = new ScriptedJudge(() => ({
      kind: 'position-shift',
      score: 0.83,
      rationale: 'המסגור השתנה, והדוברת אומרת זאת במפורש.',
    }));

    const [judgment] = await analyzeStatement({ corpus, judge, surfacingThreshold: 0.7 }, pair.later.id);

    // Distinct from a contradiction on purpose: someone who changed their mind and said
    // so is a different claim about them than someone who denies ever holding the view.
    assert.equal(judgment.kind, 'position-shift');
    assert.equal(judgment.surfaced, true);
  },
} satisfies Case<void>;
