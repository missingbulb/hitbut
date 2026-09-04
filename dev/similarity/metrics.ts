// The numbers the comparison reports, as pure functions: a retrieval's recall and rank, a
// distance's power to separate two groups, and a judge's per-relation precision and
// recall. Nothing here knows what a claim or a model is.
import { RELATIONS, type Relation } from './pairs.ts';

/** The share of the relevant ids that appear in the first k of a ranking. */
export function recallAtK(ranked: string[], relevant: Set<string>, k: number): number {
  if (relevant.size === 0) throw new Error('recall is undefined with nothing relevant');
  const top = new Set(ranked.slice(0, k));
  let hit = 0;
  for (const id of relevant) if (top.has(id)) hit += 1;
  return hit / relevant.size;
}

/** 1 over the rank of the first relevant id, 0 when none is ranked. */
export function reciprocalRank(ranked: string[], relevant: Set<string>): number {
  const index = ranked.findIndex((id) => relevant.has(id));
  return index === -1 ? 0 : 1 / (index + 1);
}

/**
 * How often a value from the group that should score low actually scores below one from
 * the group that should score high — the area under the ROC curve of a distance as a
 * classifier. 1 is perfect separation, 0.5 is a coin toss; ties count half.
 */
export function separation(low: number[], high: number[]): number {
  if (low.length === 0 || high.length === 0) throw new Error('separation needs a value in each group');
  let wins = 0;
  for (const l of low) for (const h of high) wins += l < h ? 1 : l === h ? 0.5 : 0;
  return wins / (low.length * high.length);
}

export type Tally = {
  precision: number;
  recall: number;
  f1: number;
  /** How many gold pairs carry this relation. */
  support: number;
  /** How many pairs the judge gave this relation. */
  predicted: number;
};

export type Scorecard = { perRelation: Record<Relation, Tally>; macroF1: number; contradictionRecall: number };

/** Precision, recall and F1 per relation. A relation with no gold and no prediction scores 0, not NaN. */
export function scorecard(gold: Relation[], predicted: Relation[]): Scorecard {
  if (gold.length !== predicted.length) throw new Error('one prediction per gold label');
  const perRelation = {} as Record<Relation, Tally>;
  for (const relation of RELATIONS) {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    gold.forEach((truth, index) => {
      const guess = predicted[index];
      if (guess === relation && truth === relation) tp += 1;
      else if (guess === relation) fp += 1;
      else if (truth === relation) fn += 1;
    });
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    perRelation[relation] = { precision, recall, f1, support: tp + fn, predicted: tp + fp };
  }
  const present = RELATIONS.filter((relation) => perRelation[relation].support > 0);
  const macroF1 = present.length ? present.reduce((sum, relation) => sum + perRelation[relation].f1, 0) / present.length : 0;
  return { perRelation, macroF1, contradictionRecall: perRelation.contradicts.recall };
}

export const mean = (values: number[]): number => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
