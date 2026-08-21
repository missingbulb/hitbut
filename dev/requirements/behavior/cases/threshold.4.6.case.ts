import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withPair } from '../../shared/fixtures.ts';
import { ScriptedJudge } from '../../shared/fakes.ts';
import { analyzeStatement } from '../../../../src/backend/analysis/run.ts';

export default {
  title: 'a judgment below the surfacing threshold is kept and left out of the surfaced set',
  async run() {
    const corpus = emptyCorpus();
    const unsure = await withPair(corpus, 'אמירה ראשונה לדוגמה.', 'אמירה שנייה לדוגמה.');
    const confident = await withPair(corpus, 'אמירה שלישית לדוגמה.', 'אמירה רביעית לדוגמה.', 'דיור');

    const judge = new ScriptedJudge((request) => ({
      kind: 'contradiction',
      score: request.later.id === unsure.later.id ? 0.55 : 0.91,
      rationale: 'הנמקה לדוגמה.',
    }));

    const [low] = await analyzeStatement({ corpus, judge, surfacingThreshold: 0.7 }, unsure.later.id);
    const [high] = await analyzeStatement({ corpus, judge, surfacingThreshold: 0.7 }, confident.later.id);

    assert.equal(low.surfaced, false);
    assert.equal(high.surfaced, true);
    assert.deepEqual((await corpus.listSurfaced()).judgments.map((judgment) => judgment.id), [high.id]);

    // Surfacing is a query, not a delete: the full distribution stays for tuning.
    assert.equal((await corpus.getJudgment(low.id))?.score, 0.55);
  },
} satisfies Case<void>;
