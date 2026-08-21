// The screen lane: the built site and the shipped Worker, driven in a pinned Chromium.
// The expected result of each case is the committed image below its leaf in
// requirements.md — approving that picture is approving the page.
import test, { after } from 'node:test';
import { build } from 'vite';
import { createTestHarness } from 'wrangler';
import { fileURLToPath } from 'node:url';
import type { Page } from 'playwright-core';
import { goldenPath, loadCase, readCases, type CaseFile } from '../registry.ts';
import { resetAndMigrate } from '../shared/migrations.ts';
import { harnessConfigPath } from '../shared/worker-config.ts';
import { corpusOn, seedCorpus, type SeededCorpus } from '../shared/fixtures.ts';
import type { D1Database } from '../../../src/backend/env.ts';
import { DESKTOP, launchBrowser, newContext, settle, SITE_ORIGIN, type Viewport } from './harness.ts';
import { compareWithGolden, refreshing } from './compare.ts';

export type ScreenContext = {
  /** Opens a site path and waits until the page itself says it has rendered. */
  open(path: string, viewport?: Viewport): Promise<Page>;
  /** Captures the page and compares it with this case's committed golden. */
  shoot(page: Page): Promise<void>;
  seeded: SeededCorpus;
};

// The real site, built the way the deploy builds it.
await build({ configFile: fileURLToPath(new URL('../../../src/frontend/vite.config.ts', import.meta.url)), logLevel: 'warn' });

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
  return {
    seeded,
    async open(sitePath: string, viewport: Viewport = DESKTOP) {
      // A fresh context per capture — state must not leak between cases — while the
      // browser itself is launched once, because process startup dominates the cost.
      const context = await newContext(browser, api, viewport);
      const page = await context.newPage();
      pages.push(page);
      // A page that fails to render is a blank screenshot and a timeout; whatever the
      // page itself said about why is the only thing that explains it.
      page.on('pageerror', (error) => console.error(`${caseFile.id} page error: ${error.message}`));
      page.on('requestfailed', (request) =>
        console.error(`${caseFile.id} request failed: ${request.url()} ${request.failure()?.errorText ?? ''}`),
      );
      await page.goto(`${SITE_ORIGIN}${sitePath}`, { waitUntil: 'commit' });
      await settle(page);
      return page;
    },
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
