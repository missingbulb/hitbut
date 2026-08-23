// The screen lane: the built site and the shipped Worker, driven in a pinned Chromium.
// The expected result of each case is the committed image below its leaf in
// requirements.md — approving that picture is approving the page.
import test, { after } from 'node:test';
import { build } from 'vite';
import { createTestHarness } from 'wrangler';
import type { Page } from 'playwright-core';
import { goldenPath, loadCase, readCases, type CaseFile } from '../registry.ts';
import { resetAndMigrate } from '../shared/migrations.ts';
import { harnessConfigPath } from '../shared/worker-config.ts';
import { corpusOn, seedCorpus, type SeededCorpus } from '../shared/fixtures.ts';
import type { D1Database } from '../../../src/backend/env.ts';
import type { OperationsView } from '../../../src/shared/api.ts';
import {
  DASHBOARD,
  DASHBOARD_UNCONFIGURED,
  DESKTOP,
  launchBrowser,
  newContext,
  settle,
  SITE,
  type App,
  type Viewport,
} from './harness.ts';
import { compareWithGolden, refreshing } from './compare.ts';

export type ScreenContext = {
  /** Opens a site path and waits until the page itself says it has rendered. */
  open(path: string, viewport?: Viewport): Promise<Page>;
  /** The same, for the operator console — a separate artifact on its own origin. */
  openDashboard(path: string, viewport?: Viewport): Promise<Page>;
  /** The console as published before anybody set an API origin. */
  openUnconfigured(path: string, viewport?: Viewport): Promise<Page>;
  /**
   * Installs the operations payload the next page will read. The shipped Worker in this
   * lane has no DASHBOARD_TOKEN — a secret is not in the committed config — so a case
   * that wants to look at a crawl builds the view from the shipped code and serves it.
   */
  serveOperations(view: OperationsView | null): void;
  /** Captures the page and compares it with this case's committed golden. */
  shoot(page: Page): Promise<void>;
  seeded: SeededCorpus;
};

// Each app built the way its own deploy builds it. VITE_API_ORIGIN is read by both apps
// and is fixed at build time, so it is set for exactly one build and cleared around the
// others — the site is served its API on its own origin here and must stay that way.
delete process.env.VITE_API_ORIGIN;
await build({ configFile: SITE.config, logLevel: 'warn' });
// The console built twice, because "nobody set the origin" is a different artifact rather
// than a different runtime state, and 8.10 is about that artifact.
await build({ configFile: DASHBOARD_UNCONFIGURED.config, logLevel: 'warn', build: { outDir: DASHBOARD_UNCONFIGURED.dist } });
// In this lane the API really is served at the console's own origin, by the route
// interception below — so this is the truthful value here, not a stand-in.
process.env.VITE_API_ORIGIN = DASHBOARD.origin;
await build({ configFile: DASHBOARD.config, logLevel: 'warn' });
delete process.env.VITE_API_ORIGIN;

const server = createTestHarness({ workers: [{ configPath: harnessConfigPath() }] });
await server.listen();
const env = await server.getWorker<{ CORPUS: D1Database }>().getEnv();
await resetAndMigrate(env.CORPUS);
const seeded = await seedCorpus(corpusOn(env.CORPUS));

const browser = await launchBrowser();
after(async () => {
  await browser.close();
  await server.close();
});

const api = async (pathAndQuery: string) => {
  const response = await server.fetch(pathAndQuery);
  return {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
    body: await response.text(),
  };
};

async function screenContext(caseFile: CaseFile): Promise<ScreenContext> {
  const pages: Page[] = [];
  let operations: OperationsView | null = null;

  const answer = async (pathAndQuery: string) => {
    if (operations && pathAndQuery.startsWith('/api/v1/operations')) {
      return { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(operations) };
    }
    return api(pathAndQuery);
  };

  const openOn = async (app: App, sitePath: string, viewport: Viewport) => {
    // A fresh context per capture — state must not leak between cases — while the
    // browser itself is launched once, because process startup dominates the cost.
    const context = await newContext(browser, answer, viewport, app);
    const page = await context.newPage();
    pages.push(page);
    // A page that fails to render is a blank screenshot and a timeout; whatever the
    // page itself said about why is the only thing that explains it.
    page.on('pageerror', (error) => console.error(`${caseFile.id} page error: ${error.message}`));
    page.on('requestfailed', (request) =>
      console.error(`${caseFile.id} request failed: ${request.url()} ${request.failure()?.errorText ?? ''}`),
    );
    await page.goto(`${app.origin}${sitePath}`, { waitUntil: 'commit' });
    await settle(page);
    return page;
  };

  return {
    seeded,
    serveOperations(view) {
      operations = view;
    },
    open: (sitePath, viewport = DESKTOP) => openOn(SITE, sitePath, viewport),
    openDashboard: (sitePath, viewport = DESKTOP) => openOn(DASHBOARD, sitePath, viewport),
    openUnconfigured: (sitePath, viewport = DESKTOP) => openOn(DASHBOARD_UNCONFIGURED, sitePath, viewport),
    async shoot(page: Page) {
      const shot = await page.screenshot({ fullPage: true, animations: 'disabled' });
      const outcome = compareWithGolden(shot, goldenPath(caseFile), `${caseFile.slug}.${caseFile.id}`);
      if (outcome === 'written') console.log(`${caseFile.id}: wrote ${caseFile.golden} — review it in the diff`);
      await page.context().close();
    },
  };
}

// One at a time, on purpose. Registered as separate top-level tests these run together,
// and eight browser contexts rendering at once on one machine starve each other until
// most of them miss the ready signal — which reads exactly like a broken page.
test('screen', async (lane) => {
  for (const caseFile of readCases('screen')) {
    const screenCase = await loadCase<ScreenContext>(caseFile);
    await lane.test(`${caseFile.id} — ${screenCase.title}`, async () => {
      await screenCase.run(await screenContext(caseFile));
    });
  }
});

if (refreshing()) console.log('goldens refreshed: review every changed image before committing it');
