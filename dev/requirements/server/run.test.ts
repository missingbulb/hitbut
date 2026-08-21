// The server lane: the shipped Worker, on the real workerd runtime, reading the committed
// wrangler.toml — so what answers these requests is what deploys.
//
// The corpus is seeded through the shipped store against the Worker's own D1 binding,
// which means even the fixture data arrives the way production data would. What this lane
// cannot tell you is whether Cloudflare's D1, Queues and R2 behave like the local ones
// (#28).
import test, { after } from 'node:test';
import { createTestHarness } from 'wrangler';
import { loadCase, readCases } from '../registry.ts';
import { resetAndMigrate } from '../shared/migrations.ts';
import { harnessConfigPath } from '../shared/worker-config.ts';
import { corpusOn, REFERENCE_NOW, seedCorpus, type SeededCorpus } from '../shared/fixtures.ts';
import type { D1Database } from '../../../src/backend/env.ts';

export type ApiContext = {
  /** A GET against the running Worker. Paths are relative to the server's URL. */
  get(path: string): Promise<Response>;
  /** Any other method, for the cases that assert on what the boundary refuses. */
  request(path: string, init: RequestInit): Promise<Response>;
  /** The same, parsed, for the majority of cases that only look at the body. */
  json<Body>(path: string): Promise<Body>;
  /** Fires the Worker's cron entry point — the same one Cloudflare's scheduler calls. */
  runScheduled(): Promise<void>;
  /** The ids the sample corpus was seeded with. */
  seeded: SeededCorpus;
};

const server = createTestHarness({ workers: [{ configPath: harnessConfigPath() }] });
await server.listen();
after(() => server.close());

const env = await server.getWorker().getEnv<{ CORPUS: D1Database }>();
await resetAndMigrate(env.CORPUS);
const seeded = await seedCorpus(corpusOn(env.CORPUS));

const context: ApiContext = {
  get: (path) => server.fetch(path),
  request: (path, init) => server.fetch(path, init),
  runScheduled: async () => {
    await server.getWorker().scheduled({ cron: '23 */3 * * *', scheduledTime: new Date(Date.parse(REFERENCE_NOW)) });
  },
  json: async <Body,>(path: string) => (await server.fetch(path)).json() as Promise<Body>,
  seeded,
};

for (const caseFile of readCases('server')) {
  const serverCase = await loadCase<ApiContext>(caseFile);
  test(`${caseFile.id} — ${serverCase.title}`, async () => {
    await serverCase.run(context);
  });
}
