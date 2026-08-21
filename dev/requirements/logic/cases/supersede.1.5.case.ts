import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { seededCorpus } from '../../shared/fixtures.ts';

export default {
  title: 're-analysing a pair supersedes the old judgment instead of overwriting it',
  async run() {
    const { corpus, judgments } = await seededCorpus();

    const old = await corpus.getJudgment(judgments.lightRailOld);
    const live = await corpus.getJudgment(judgments.lightRail);

    assert.equal(old?.supersededBy, live?.id, 'the older record points forward at what replaced it');
    assert.equal(old?.surfaced, false, 'and drops out of what the product shows');
    assert.equal(old?.score, 0.71, 'while keeping what it actually said');
    assert.equal(old?.modelVersion, 'sample/judge-0', 'and which model said it');

    assert.equal(live?.supersededBy, null);
    assert.equal(live?.surfaced, true);

    const surfaced = await corpus.listSurfaced();
    const forThisPair = surfaced.judgments.filter((judgment) => judgment.earlierStatementId === old?.earlierStatementId);
    assert.deepEqual(forThisPair.map((judgment) => judgment.id), [live?.id], 'exactly one live judgment per pair');
  },
} satisfies Case<void>;
