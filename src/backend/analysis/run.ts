// One statement off the queue, judged against the statements it could plausibly conflict
// with. Pairing is the cost control and the correctness rule at once: two figures
// disagreeing is not an inconsistency, and one figure's unrelated statements are not a
// pair worth paying a model to read.
import type { Judgment, Statement } from '../../shared/types.ts';
import type { Corpus } from '../corpus/store.ts';
import type { Judge } from './judge.ts';

export type Pair = { earlier: Statement; later: Statement };

/**
 * Orders a pair in time. When a date is unknown the ids decide, because a ULID sorts by
 * the moment it was minted — so the order is "as extracted", which is the only ordering
 * the corpus can honestly claim about undated statements.
 */
export function orderPair(a: Statement, b: Statement): Pair {
  if (a.saidAt && b.saidAt) return a.saidAt <= b.saidAt ? { earlier: a, later: b } : { earlier: b, later: a };
  return a.id <= b.id ? { earlier: a, later: b } : { earlier: b, later: a };
}

export type AnalysisOptions = {
  corpus: Corpus;
  judge: Judge;
  /** A judgment at or above this score, and not `consistent`, is shown in the product. */
  surfacingThreshold: number;
};

export async function analyzeStatement(options: AnalysisOptions, statementId: string): Promise<Judgment[]> {
  const statement = await options.corpus.getStatement(statementId);
  if (!statement) return [];
  const figure = await options.corpus.getFigure(statement.figureId);
  if (!figure) return [];

  const partners = await options.corpus.candidatePartners(statement);
  const recorded: Judgment[] = [];

  for (const partner of partners) {
    const pair = orderPair(statement, partner);
    const already = await options.corpus.judgmentsForPair(pair.earlier.id, pair.later.id);
    const live = already.find((judgment) => judgment.supersededBy === null);
    // The same pair, already read by this model under this prompt: nothing new to learn,
    // and re-judging would churn ids readers may have cited.
    if (live && live.modelVersion === options.judge.modelVersion && live.promptVersion === options.judge.promptVersion) {
      continue;
    }

    const verdict = await options.judge.judge({ figure, earlier: pair.earlier, later: pair.later });
    recorded.push(
      await options.corpus.recordJudgment(
        {
          figureId: figure.id,
          earlierStatementId: pair.earlier.id,
          laterStatementId: pair.later.id,
          kind: verdict.kind,
          score: verdict.score,
          rationale: verdict.rationale,
          modelVersion: options.judge.modelVersion,
          promptVersion: options.judge.promptVersion,
        },
        options.surfacingThreshold,
      ),
    );
  }
  return recorded;
}
