import type { R2Bucket, R2Object } from '../../../src/backend/env.ts';
// Stand-ins for the platform and for the model. Each one *records* what the product asked
// it for, because that recording is what a behavior case asserts against — the point is
// never that the fake worked, it is what our code did with it.
import type { Embedder, Neighbour, Placement, StanceModel, Vectors } from '../../../src/backend/ingestion/ports.ts';
import { tokenize } from '../../../src/shared/text.ts';

/**
 * The raw payload cache. `log` can be shared with other fakes so a case can assert the
 * *order* two things happened in — which is the whole of "raw before parse".
 */
export class FakeR2 implements R2Bucket {
  objects = new Map<string, string>();
  log: string[];

  constructor(log: string[] = []) {
    this.log = log;
  }

  async put(key: string, value: string | ArrayBuffer): Promise<unknown> {
    this.log.push(`put ${key}`);
    this.objects.set(key, String(value));
    return {};
  }

  async get(key: string): Promise<R2Object | null> {
    const stored = this.objects.get(key);
    return stored === undefined ? null : { text: async () => stored };
  }

  async head(key: string): Promise<unknown | null> {
    return this.objects.has(key) ? {} : null;
  }
}

export type ScriptedResponse = { status: number; body: string } | Error;

/**
 * An HTTP surface the case writes out in advance, plus the record of what was asked for —
 * so "did it retry?" and "how many times?" are assertions rather than guesses.
 */
export function scriptedFetch(responses: ScriptedResponse[]) {
  const calls: string[] = [];
  const waits: number[] = [];
  let index = 0;
  return {
    calls,
    waits,
    deps: {
      fetch: async (url: string) => {
        calls.push(url);
        const next = responses[Math.min(index++, responses.length - 1)];
        if (next instanceof Error) throw next;
        return { status: next.status, text: async () => next.body };
      },
      // Records the backoff instead of serving it: the retry path is exercised, the test
      // does not sleep through it.
      sleep: async (milliseconds: number) => {
        waits.push(milliseconds);
      },
      random: () => 0.5,
    },
  };
}

/** The same, but keyed by URL — for a run over several documents. */
export function servingFetch(routes: Record<string, ScriptedResponse>) {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      fetch: async (url: string) => {
        calls.push(url);
        const response = routes[url] ?? { status: 404, body: 'not found' };
        if (response instanceof Error) throw response;
        return { status: response.status, text: async () => response.body };
      },
      sleep: async () => {},
      random: () => 0.5,
    },
  };
}

/** A fetcher that fails the test if anything reaches for the network. */
export const forbiddenFetch = {
  fetch: async (url: string): Promise<never> => {
    throw new Error(`the network was used for ${url}, and this path must not need it`);
  },
};

// ---- the ingestion chain's three ports ------------------------------------------------
//
// Deterministic stand-ins for an embedding model, a vector index and a stance model. They
// are not models: what a case proves against them is what the *pipeline* does with an
// embedding, never what an embedding is. Each can be told to fail on cue, which is how the
// partial-progress requirement is provable at all.

/**
 * A bag-of-folded-words vector. Two texts sharing words land near each other, which is
 * enough structure for a case about assignment and nothing like a real embedding — the
 * point is that it is the same answer on every machine, forever.
 */
export class FakeEmbedder implements Embedder {
  readonly modelVersion = 'sample/embed-0';
  /** Set to fail the next call, the way a rate limit or a timeout would. */
  failWith: string | null = null;
  calls = 0;

  async embed(text: string): Promise<number[]> {
    this.calls += 1;
    if (this.failWith) throw new Error(this.failWith);
    const words = new Set(tokenize(text));
    // A fixed axis per run, so two texts are compared on the same coordinates.
    return [...FakeEmbedder.AXIS].map((word) => (words.has(word) ? 1 : 0));
  }

  /** The vocabulary the fixtures actually use, in a fixed order. */
  static AXIS = [
    'רכבת', 'קלה', 'תקציב', 'דיור', 'היתרי', 'בנייה', 'תחבורה', 'ציבורית',
    'חינוך', 'ועדת', 'עדיפות', 'שקל', 'הזמנים', 'לוחות',
  ];
}

export class FakeVectors implements Vectors {
  #stored = new Map<string, number[]>();
  failWith: string | null = null;

  async upsert(utteranceId: string, vector: number[]): Promise<void> {
    if (this.failWith) throw new Error(this.failWith);
    this.#stored.set(utteranceId, vector);
  }

  async has(utteranceId: string): Promise<boolean> {
    return this.#stored.has(utteranceId);
  }

  async nearest(vector: number[], limit: number): Promise<Neighbour[]> {
    if (this.failWith) throw new Error(this.failWith);
    return [...this.#stored]
      .map(([id, stored]) => ({ id, distance: cosineDistance(vector, stored) }))
      // Ties broken by id so the answer does not depend on insertion order.
      .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
      .slice(0, limit);
  }

  get size(): number {
    return this.#stored.size;
  }
}

/** 0 for identical direction, 1 for nothing in common. Empty vectors are maximally far. */
function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (!normA || !normB) return 1;
  return 1 - dot / Math.sqrt(normA * normB);
}

/**
 * A scripted stance model: the case says what position each text gets, so a series with a
 * planted change or a planted outlier is something a case can construct exactly.
 */
export class FakeStance implements StanceModel {
  readonly modelVersion: string;
  readonly promptVersion: string;
  failWith: string | null = null;
  calls = 0;
  #positions: Map<string, number>;

  constructor(positions: Record<string, number> = {}, versions: { model?: string; prompt?: string } = {}) {
    this.#positions = new Map(Object.entries(positions));
    this.modelVersion = versions.model ?? 'sample/stance-0';
    this.promptVersion = versions.prompt ?? 'stance-v1';
  }

  async place(input: { text: string }): Promise<Placement> {
    this.calls += 1;
    if (this.failWith) throw new Error(this.failWith);
    // Unscripted text sits at the origin: a case that did not say where something stands is
    // a case that is not about where it stands.
    return { position: this.#positions.get(input.text) ?? 0, confidence: 0.8 };
  }
}
