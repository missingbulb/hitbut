// One backfill world: the shipped slice runner over the shipped fetcher, ingestion chain
// and registry, with the platform faked underneath. Deliberately built on the same fakes
// the acquisition harness uses — the two drivers run the same pipeline, and a case that
// proved the backfill against a different set of fakes would be proving something else.
import type { SourceModule } from '../../../src/backend/acquisition/registry.ts';
import type { SliceDeps } from '../../../src/backend/backfill/slice.ts';
import { FakeEmbedder, FakeR2, FakeStance, FakeVectors, servingFetch, type ScriptedResponse } from './fakes.ts';
import { emptyCorpus, fixtureSource, SAMPLE_ROSTER, STAND_IN, REFERENCE_NOW } from './fixtures.ts';

export type ArchiveDocument = { key: string; url: string; payload: string; response?: ScriptedResponse };

export async function backfillWorld(documents: ArchiveDocument[], stancePositions: Record<string, number> = {}) {
  const log: string[] = [];
  const raw = new FakeR2(log);
  const embedder = new FakeEmbedder();
  const vectors = new FakeVectors();
  const stance = new FakeStance(stancePositions);
  const corpus = emptyCorpus();
  await corpus.syncRoster([...SAMPLE_ROSTER, STAND_IN]);

  const module: SourceModule = fixtureSource({ documents, onExtract: (key) => log.push(`extract ${key}`) });

  const routes: Record<string, ScriptedResponse> = {};
  for (const document of documents) routes[document.url] = document.response ?? { status: 200, body: document.payload };
  const http = servingFetch(routes);

  let tick = 0;
  const deps: SliceDeps = {
    corpus,
    raw,
    roster: [...SAMPLE_ROSTER, STAND_IN],
    ingestion: { embedder, vectors, stance },
    fetchDeps: http.deps,
    now: () => new Date(Date.parse(REFERENCE_NOW) + tick++ * 1000).toISOString(),
  };

  return { deps, module, corpus, raw, http, log, embedder, stance };
}
