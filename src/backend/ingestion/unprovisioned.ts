// The ports as they stand before phase 0 provisioning (#27): no Vectorize index exists,
// and neither the embedding model nor the stance model has been chosen.
//
// They fail loudly rather than quietly succeeding. A no-op embedder would let every pass
// report success while the corpus silently gained no subjects and no stances, and the
// first person to look would find an empty analysis with nothing anywhere saying why. What
// this gives instead is a per-pass line naming the exact missing capability, and utterances
// and attestations that still land — the merge stage commits before any of this is reached,
// so nothing is lost and nothing has to be re-fetched once the bindings exist.
//
// When #27 lands, this file is replaced by the real implementations and nothing else moves.
import type { Embedder, StanceModel, Vectors } from './ports.ts';

const NOT_YET = (what: string) =>
  new Error(`${what} is not provisioned yet — see issue #27. Utterances and attestations still land; subjects and stances wait.`);

export const UNPROVISIONED_EMBEDDER: Embedder = {
  modelVersion: 'unprovisioned',
  embed: () => Promise.reject(NOT_YET('the embedding model')),
};

export const UNPROVISIONED_VECTORS: Vectors = {
  upsert: () => Promise.reject(NOT_YET('the vector index')),
  // False rather than a rejection: the pipeline asks this first, and answering "no vector
  // here" is true and lets it reach the stage that reports the real reason.
  has: () => Promise.resolve(false),
  nearest: () => Promise.reject(NOT_YET('the vector index')),
};

export const UNPROVISIONED_STANCE: StanceModel = {
  modelVersion: 'unprovisioned',
  promptVersion: 'unprovisioned',
  place: () => Promise.reject(NOT_YET('the stance model')),
};
