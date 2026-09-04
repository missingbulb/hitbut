// The protocol: what is measured, over which pairs, in what order. One function, so the
// run against scripted models today and the run against real ones later are the same run
// with different methods passed in (docs/architecture/claim-similarity.md §5).
import { mean, recallAtK, reciprocalRank, scorecard, separation, type Scorecard } from './metrics.ts';
import type { Cost, PairJudge, Retriever } from './methods.ts';
import { LOGICAL, RELATIONS, claimsOf, type LabelledPair, type Relation } from './pairs.ts';

/** The depths retrieval is read at: the all-pairs pass picks one of them as its k. */
export const CUTOFFS = [5, 20, 100] as const;

export type RetrievalResult = {
  recallAt: Record<number, number>;
  mrr: number;
  /** How well the distance keeps pairs about one subject nearer than unrelated ones. */
  subjectSeparation: number | null;
  /** Claims with at least one logical partner — the ones a recall can be read on. */
  queries: number;
  cost: Cost;
};

export type JudgmentResult = Scorecard & { cost: Cost };

export type Report = {
  pairs: { count: number; claims: number; byRelation: Record<Relation, number> };
  retrieval: Record<string, RetrievalResult>;
  judgment: Record<string, JudgmentResult>;
};

export type Methods = { retrievers: Retriever[]; judges: PairJudge[] };

export async function compare(pairs: LabelledPair[], methods: Methods): Promise<Report> {
  const claims = claimsOf(pairs);
  const byRelation = Object.fromEntries(RELATIONS.map((relation) => [relation, 0])) as Record<Relation, number>;
  for (const pair of pairs) byRelation[pair.relation] += 1;

  // Who each claim's logical partners are, read off the set in both directions.
  const partners = new Map<string, Set<string>>();
  for (const pair of pairs) {
    if (!LOGICAL.includes(pair.relation)) continue;
    for (const [from, to] of [[pair.a.id, pair.b.id], [pair.b.id, pair.a.id]] as const) {
      const set = partners.get(from) ?? new Set<string>();
      set.add(to);
      partners.set(from, set);
    }
  }
  const queries = [...partners.keys()].sort();

  const retrieval: Record<string, RetrievalResult> = {};
  for (const retriever of methods.retrievers) {
    await retriever.index(claims);
    const deepest = Math.max(...CUTOFFS);
    const rankings = queries.map((id) => ({
      ranked: retriever.nearest(id, deepest).map((neighbour) => neighbour.id),
      relevant: partners.get(id) as Set<string>,
    }));
    const recallAt = Object.fromEntries(
      CUTOFFS.map((k) => [k, mean(rankings.map(({ ranked, relevant }) => recallAtK(ranked, relevant, k)))]),
    ) as Record<number, number>;
    const about = pairs.filter((pair) => pair.relation !== 'unrelated').map((pair) => retriever.distance(pair.a.id, pair.b.id));
    const apart = pairs.filter((pair) => pair.relation === 'unrelated').map((pair) => retriever.distance(pair.a.id, pair.b.id));
    retrieval[retriever.name] = {
      recallAt,
      mrr: mean(rankings.map(({ ranked, relevant }) => reciprocalRank(ranked, relevant))),
      subjectSeparation: about.length && apart.length ? separation(about, apart) : null,
      queries: queries.length,
      cost: { ...retriever.cost },
    };
  }

  const judgment: Record<string, JudgmentResult> = {};
  for (const judge of methods.judges) {
    const predicted: Relation[] = [];
    for (const pair of pairs) predicted.push((await judge.judge(pair.a, pair.b)).relation);
    judgment[judge.name] = { ...scorecard(pairs.map((pair) => pair.relation), predicted), cost: { ...judge.cost } };
  }

  return { pairs: { count: pairs.length, claims: claims.length, byRelation }, retrieval, judgment };
}

const pct = (value: number | null): string => (value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`);

/** The report as the table a person reads; the JSON is what a later run is diffed against. */
export function renderReport(report: Report): string {
  const lines: string[] = [];
  lines.push(
    `Pairs: ${report.pairs.count} over ${report.pairs.claims} claims — ${RELATIONS.map((relation) => `${relation} ${report.pairs.byRelation[relation]}`).join(', ')}`,
  );
  lines.push('');
  lines.push(`| retriever | ${CUTOFFS.map((k) => `recall@${k}`).join(' | ')} | MRR | subject separation | queries | calls | characters |`);
  lines.push(`|---|${CUTOFFS.map(() => '---').join('|')}|---|---|---|---|---|`);
  for (const [name, result] of Object.entries(report.retrieval)) {
    const recalls = CUTOFFS.map((k) => pct(result.recallAt[k])).join(' | ');
    lines.push(
      `| ${name} | ${recalls} | ${result.mrr.toFixed(3)} | ${pct(result.subjectSeparation)} | ${result.queries} | ${result.cost.calls} | ${result.cost.characters} |`,
    );
  }
  lines.push('');
  lines.push(`| judge | ${RELATIONS.map((relation) => `${relation} P/R`).join(' | ')} | macro F1 | contradiction recall | calls | characters |`);
  lines.push(`|---|${RELATIONS.map(() => '---').join('|')}|---|---|---|---|`);
  for (const [name, result] of Object.entries(report.judgment)) {
    const cells = RELATIONS.map((relation) => `${pct(result.perRelation[relation].precision)} / ${pct(result.perRelation[relation].recall)}`);
    lines.push(
      `| ${name} | ${cells.join(' | ')} | ${result.macroF1.toFixed(3)} | ${pct(result.contradictionRecall)} | ${result.cost.calls} | ${result.cost.characters} |`,
    );
  }
  return lines.join('\n');
}
