// The syntactic–semantic Jaccard measure of Heldring & Torres (arXiv 2608.15325), as a pure
// function over decompositions someone else produced. What a model contributes — the
// premises, the conclusion's consequences, the entailment judgments — comes in as
// arguments; what this computes is the counting, which is the part the paper's worked
// example pins down exactly (docs/architecture/claim-similarity.md §1).
//
// Two arguments are compared on two Jaccard overlaps: their premise sets and the
// consequence sets of their conclusions, each taken modulo the equivalence the judgments
// establish. The overlap counts *classes*, which is what the paper's Figures 3 and 4 do
// (one premise on one side equivalent to both on the other is one shared class out of
// two) — its Definition 20 counts formulas instead and gives a third there; the figures
// are what the reported numbers come from, so the figures win.

/** Whether two clauses entail each other. Symmetric by definition; called once per pair. */
export type Equivalent = (x: string, y: string) => Promise<boolean>;

export type Decomposed = {
  premises: string[];
  /** The conclusion's consequences in CNF — the paper's CN_F(φ) — listed once each. */
  consequences: string[];
};

export type Overlap = {
  /** Classes with a member on each side. */
  shared: number;
  /** Classes in the union. */
  distinct: number;
  /** The classes themselves, each as the clauses it holds — the trail a reader can check. */
  classes: string[][];
};

export type Similarity = {
  similarity: number;
  premises: Overlap;
  consequences: Overlap;
};

/**
 * Jaccard overlap of two clause lists modulo equivalence. Cross-side pairs are judged, and
 * equivalence is closed transitively over what was judged: a clause on the left equivalent
 * to two on the right makes all three one class. Two clauses on the same side that are
 * equivalent to each other but to nothing opposite stay two classes — the paper takes
 * premise sets to be non-redundant, and judging same-side pairs would double the calls to
 * find out whether a model's decomposition honoured that.
 */
export async function classOverlap(left: string[], right: string[], equivalent: Equivalent): Promise<Overlap> {
  const items = [...left.map((clause) => ({ clause, side: 'left' as const })), ...right.map((clause) => ({ clause, side: 'right' as const }))];
  const parent = items.map((_, index) => index);
  const find = (index: number): number => (parent[index] === index ? index : (parent[index] = find(parent[index])));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };

  for (let i = 0; i < left.length; i++) {
    for (let j = 0; j < right.length; j++) {
      if (await equivalent(left[i], right[j])) union(i, left.length + j);
    }
  }

  const byRoot = new Map<number, { clauses: string[]; sides: Set<'left' | 'right'> }>();
  items.forEach((item, index) => {
    const root = find(index);
    const group = byRoot.get(root) ?? { clauses: [], sides: new Set() };
    group.clauses.push(item.clause);
    group.sides.add(item.side);
    byRoot.set(root, group);
  });
  const groups = [...byRoot.values()];
  return {
    shared: groups.filter((group) => group.sides.size === 2).length,
    distinct: groups.length,
    classes: groups.map((group) => group.clauses),
  };
}

/** The paper's convention: two empty sets are maximally similar, one empty set is not. */
const ratio = (overlap: Overlap, left: number, right: number): number => {
  if (left === 0 && right === 0) return 1;
  if (left === 0 || right === 0) return 0;
  return overlap.shared / overlap.distinct;
};

/**
 * sim^σ(a, b) = σ · s_syn + (1 − σ) · s_sem, for 0 < σ < 1. One is returned exactly when
 * every class is shared on both sides — the paper's Theorem 1, argument equivalence.
 */
export async function syntacticSemanticJaccard(
  a: Decomposed,
  b: Decomposed,
  equivalent: Equivalent,
  sigma = 0.5,
): Promise<Similarity> {
  if (!(sigma > 0 && sigma < 1)) throw new Error(`sigma must lie strictly between 0 and 1, got ${sigma}`);
  const premises = await classOverlap(a.premises, b.premises, equivalent);
  const consequences = await classOverlap(a.consequences, b.consequences, equivalent);
  const syntactic = ratio(premises, a.premises.length, b.premises.length);
  const semantic = ratio(consequences, a.consequences.length, b.consequences.length);
  return { similarity: sigma * syntactic + (1 - sigma) * semantic, premises, consequences };
}
