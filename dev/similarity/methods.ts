// The methods under comparison, each behind one of two seams: a retriever (a distance
// between claims, and the nearest ones to a claim) and a pair judge (a relation between
// two claims). The comparison scores the seams, never the models — which is what lets it
// run today on the one method that needs no model, and score a real one by wiring it here
// once it is reachable (#27).
import type { Embedder } from '../../src/backend/ingestion/ports.ts';
import { indexTerms } from '../../src/shared/text.ts';
import { syntacticSemanticJaccard, type Decomposed, type Similarity } from './measure.ts';
import type { Claim, Relation } from './pairs.ts';

/** What a method spent. Characters rather than tokens: tokens are a model's own count. */
export type Cost = { calls: number; characters: number };

export type Neighbour = { id: string; distance: number };

export type Retriever = {
  readonly name: string;
  readonly cost: Cost;
  /** Sees every claim once before any distance is asked for. */
  index(claims: Claim[]): Promise<void>;
  /** Between two indexed claims; 0 is identical, 1 is nothing in common. */
  distance(a: string, b: string): number;
  /** The nearest indexed claims to one of them, itself excluded, nearest first, ties by id. */
  nearest(claimId: string, limit: number): Neighbour[];
};

export type Judgment = {
  relation: Relation;
  /** The judge's own confidence or similarity, 0..1 — reported, never compared across judges. */
  score: number;
  /** Whatever lets a reader check the judgment: matched clauses, class probabilities, a reason. */
  trail?: unknown;
};

export type PairJudge = {
  readonly name: string;
  readonly cost: Cost;
  judge(a: Claim, b: Claim): Promise<Judgment>;
};

/**
 * Exact nearest-neighbour over a distance between stored representations. Brute force on
 * purpose: the comparison measures the *distance*, and an approximate index would mix its
 * own recall into the number. Production uses Vectorize; a benchmark set fits in memory.
 */
function exactRetriever<Stored>(
  name: string,
  cost: Cost,
  represent: (claim: Claim) => Promise<Stored>,
  distanceOf: (x: Stored, y: Stored) => number,
): Retriever {
  const stored = new Map<string, Stored>();
  const of = (id: string): Stored => {
    const representation = stored.get(id);
    if (representation === undefined) throw new Error(`${name}: claim ${id} was never indexed`);
    return representation;
  };
  return {
    name,
    cost,
    async index(claims) {
      for (const claim of claims) stored.set(claim.id, await represent(claim));
    },
    distance: (a, b) => distanceOf(of(a), of(b)),
    nearest(claimId, limit) {
      const self = of(claimId);
      return [...stored]
        .filter(([id]) => id !== claimId)
        .map(([id, other]) => ({ id, distance: distanceOf(self, other) }))
        .sort((x, y) => x.distance - y.distance || x.id.localeCompare(y.id))
        .slice(0, limit);
    },
  };
}

/** 0 for the same direction, 1 for orthogonal or empty. */
export function cosineDistance(x: number[], y: number[]): number {
  let dot = 0;
  let normX = 0;
  let normY = 0;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const a = x[i] ?? 0;
    const b = y[i] ?? 0;
    dot += a * b;
    normX += a * a;
    normY += b * b;
  }
  if (!normX || !normY) return 1;
  return 1 - dot / Math.sqrt(normX * normY);
}

// ---- lexical: the baseline that runs today ----------------------------------------------

const termSet = (text: string): Set<string> => new Set(indexTerms(text));

/** 1 − Jaccard over two folded term sets. */
function jaccardDistance(x: Set<string>, y: Set<string>): number {
  if (x.size === 0 && y.size === 0) return 0;
  let shared = 0;
  for (const term of x) if (y.has(term)) shared += 1;
  return 1 - shared / (x.size + y.size - shared);
}

/** 1 − Jaccard over the folded terms the search index already writes. */
export const lexicalDistance = (a: string, b: string): number => jaccardDistance(termSet(a), termSet(b));

/**
 * Hebrew-aware token overlap — what the corpus's search does, as a retriever. It is the
 * floor every model has to clear, and the one method with no cost column.
 */
export function lexicalRetriever(): Retriever {
  return exactRetriever('lexical', { calls: 0, characters: 0 }, async (claim) => termSet(claim.text), jaccardDistance);
}

/**
 * The same overlap read as a relation. It can say "the same words" and "some of the same
 * words" and nothing else: its contradiction recall is zero by construction, which is the
 * number that shows why a judge has to read meaning.
 */
export function lexicalJudge(thresholds = { equivalent: 0.8, sameSubject: 0.25 }): PairJudge {
  return {
    name: 'lexical',
    cost: { calls: 0, characters: 0 },
    async judge(a, b) {
      const overlap = 1 - lexicalDistance(a.text, b.text);
      const relation: Relation =
        overlap >= thresholds.equivalent ? 'equivalent' : overlap >= thresholds.sameSubject ? 'same-subject' : 'unrelated';
      return { relation, score: overlap };
    },
  };
}

// ---- model-backed: the seams a real method is wired into ------------------------------

/** Cosine distance over an `Embedder` — the ingestion port, so a Worker-reachable model plugs in unchanged. */
export function embeddingRetriever(embedder: Embedder): Retriever {
  const cost: Cost = { calls: 0, characters: 0 };
  return exactRetriever(
    `embedding:${embedder.modelVersion}`,
    cost,
    async (claim) => {
      cost.calls += 1;
      cost.characters += claim.text.length;
      return embedder.embed(claim.text);
    },
    cosineDistance,
  );
}

/**
 * A model that judges a pair: an NLI cross-encoder, an LLM prompt, or anything else that
 * takes two texts and returns a relation. This is the shape a pair-judging port would take
 * beside `StanceModel` in the ingestion ports, once the comparison has earned it a place.
 */
export type PairModel = {
  readonly modelVersion: string;
  readonly promptVersion: string;
  judge(a: string, b: string): Promise<Judgment>;
};

export function modelJudge(model: PairModel, kind = 'model'): PairJudge {
  const cost: Cost = { calls: 0, characters: 0 };
  return {
    name: `${kind}:${model.modelVersion}/${model.promptVersion}`,
    cost,
    async judge(a, b) {
      cost.calls += 1;
      cost.characters += a.text.length + b.text.length;
      return model.judge(a.text, b.text);
    },
  };
}

/**
 * What the paper's method needs from a model: the decomposition prompts and the
 * clause-level relation. `relate` is three-way rather than the paper's yes/no because a
 * product looking for inconsistency needs the third answer — the paper's measure scores an
 * argument and its negation exactly as it scores two unrelated ones.
 */
export type ClauseModel = {
  readonly modelVersion: string;
  readonly promptVersion: string;
  decompose(text: string): Promise<Decomposed>;
  relate(p: string, q: string): Promise<'entails' | 'contradicts' | 'neutral'>;
};

/**
 * The paper's measure as a judge. Equivalent when the measure is 1; contradicts when any
 * two consequences contradict; entails when every consequence class is shared; same-subject
 * on any overlap at all; unrelated on none. The mapping from a similarity to a relation is
 * this harness's, not the paper's — the paper reports similarity only.
 */
export function logicalJudge(model: ClauseModel, sigma = 0.5): PairJudge {
  const cost: Cost = { calls: 0, characters: 0 };
  const decompositions = new Map<string, Promise<Decomposed>>();
  const decompose = (text: string): Promise<Decomposed> => {
    let pending = decompositions.get(text);
    if (!pending) {
      cost.calls += 1;
      cost.characters += text.length;
      pending = model.decompose(text);
      decompositions.set(text, pending);
    }
    return pending;
  };
  return {
    name: `logical:${model.modelVersion}/${model.promptVersion}`,
    cost,
    async judge(a, b) {
      const [left, right] = await Promise.all([decompose(a.text), decompose(b.text)]);
      const relations = new Map<string, 'entails' | 'contradicts' | 'neutral'>();
      const relate = async (p: string, q: string) => {
        const key = `${p} ${q}`;
        let relation = relations.get(key);
        if (!relation) {
          cost.calls += 1;
          cost.characters += p.length + q.length;
          relation = await model.relate(p, q);
          relations.set(key, relation);
        }
        return relation;
      };
      const equivalent = async (p: string, q: string) => (await relate(p, q)) === 'entails' && (await relate(q, p)) === 'entails';
      const measured: Similarity = await syntacticSemanticJaccard(left, right, equivalent, sigma);

      let contradicted = false;
      for (const p of left.consequences) {
        for (const q of right.consequences) {
          if ((await relate(p, q)) === 'contradicts') contradicted = true;
        }
      }
      const covered = measured.consequences.distinct > 0 && measured.consequences.shared === measured.consequences.distinct;
      const relation: Relation = contradicted
        ? 'contradicts'
        : measured.similarity === 1
          ? 'equivalent'
          : covered
            ? 'entails'
            : measured.similarity > 0
              ? 'same-subject'
              : 'unrelated';
      return {
        relation,
        score: measured.similarity,
        trail: { premises: measured.premises.classes, consequences: measured.consequences.classes },
      };
    },
  };
}
