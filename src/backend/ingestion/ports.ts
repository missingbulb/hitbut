// What ingestion needs from the outside world, as the narrowest interfaces that say it.
//
// Three of the pipeline's stages are model or vector-store calls. Behind these seams they
// are scriptable, so a case can prove what the pipeline does with an embedding without
// asserting anything about what an embedding is — and phase 5 can change the model, the
// index or the prompt without touching a case.

/** Turns text into a vector. One call per utterance, so cost is linear in the corpus. */
export type Embedder = {
  /** Identifies which model produced a vector; two models' vectors are not comparable. */
  readonly modelVersion: string;
  embed(text: string): Promise<number[]>;
};

export type Neighbour = {
  /** The utterance the vector belongs to. */
  id: string;
  /** Distance, not similarity: smaller is nearer, so a threshold reads the obvious way. */
  distance: number;
};

/** The vector index. D1 has no vector type and the retrieval needed is nearest-neighbour. */
export type Vectors = {
  /** Keyed on the utterance id, so writing the same utterance twice stores one vector. */
  upsert(utteranceId: string, vector: number[]): Promise<void>;
  has(utteranceId: string): Promise<boolean>;
  nearest(vector: number[], limit: number): Promise<Neighbour[]>;
};

export type Placement = {
  /** Where on the subject's axis, -1..1. */
  position: number;
  /** 0..1. */
  confidence: number;
};

/**
 * Places one utterance on its subject's axis. A separate call from the embedding on
 * purpose: distance measures aboutness, not agreement, so position is a judgment that has
 * to be made and recorded rather than read off the geometry.
 */
export type StanceModel = {
  readonly modelVersion: string;
  readonly promptVersion: string;
  place(input: { text: string; neighbours: { text: string; position: number }[] }): Promise<Placement>;
};
