// One acquisition world, wired the way the Worker wires it: the shipped run over the
// shipped fetcher and the shipped registry, with the platform faked underneath and every
// interesting moment written to one shared log so a case can assert on the *order*.
import { SourceRegistry, type SourceModule } from '../../../src/backend/acquisition/registry.ts';
import type { AcquisitionOptions } from '../../../src/backend/acquisition/run.ts';
import { FakeEmbedder, FakeQueue, FakeR2, FakeStance, FakeVectors, servingFetch, type ScriptedResponse } from './fakes.ts';
import { emptyCorpus, fixtureSource, SAMPLE_ROSTER, STAND_IN, REFERENCE_NOW } from './fixtures.ts';

export type HarnessDocument = { key: string; url: string; payload: string; response?: ScriptedResponse };

export async function acquisitionWorld(
  documents: HarnessDocument[],
  moduleOverrides: Partial<SourceModule> = {},
  stancePositions: Record<string, number> = {},
) {
  const log: string[] = [];
  const raw = new FakeR2(log);
  const queue = new FakeQueue();
  const embedder = new FakeEmbedder();
  const vectors = new FakeVectors();
  const stance = new FakeStance(stancePositions);
  const corpus = emptyCorpus();
  // The roster is an input to acquisition, so the harness supplies it the way the Worker
  // does — synced before the pass, never grown by it.
  await corpus.syncRoster([...SAMPLE_ROSTER, STAND_IN]);
  const registry = new SourceRegistry();

  const module = fixtureSource({
    documents,
    onExtract: (key) => log.push(`extract ${key}`),
  });
  registry.register({ ...module, ...moduleOverrides });

  const routes: Record<string, ScriptedResponse> = {};
  for (const document of documents) routes[document.url] = document.response ?? { status: 200, body: document.payload };
  const http = servingFetch(routes);

  let tick = 0;
  const options: AcquisitionOptions = {
    corpus,
    raw,
    queue,
    registry,
    roster: [...SAMPLE_ROSTER, STAND_IN],
    ingestion: { embedder, vectors, stance },
    deps: http.deps,
    now: () => new Date(Date.parse(REFERENCE_NOW) + tick++ * 1000).toISOString(),
  };

  return { options, corpus, raw, queue, registry, log, http, embedder, vectors, stance };
}

/** A payload in the fixture format: one line per quote, `speaker|date|topics|quote`. */
export const payloadOf = (lines: [speaker: string, date: string, topics: string, quote: string][]): string =>
  lines.map((line) => line.join('|')).join('\n');
