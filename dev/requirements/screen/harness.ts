// The screen lane's world: the built site, the running Worker, and one browser pinned to
// the build the goldens were rendered with.
//
// Nothing here reaches the network. The site is served from `dist` by fulfilling requests
// at the browser, `/api/v1` is fulfilled from the running Worker, and everything else is
// aborted — so a new external dependency breaks the run loudly instead of quietly making
// it non-hermetic.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { REFERENCE_NOW } from '../shared/fixtures.ts';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DIST = path.join(REPO_ROOT, 'src/frontend/dist');
const FALLBACK_FONTS = path.join(REPO_ROOT, 'dev/requirements/screen/fallback-fonts');
const SCRATCH = path.join(REPO_ROOT, '.wrangler', 'requirements');

/**
 * The browser build these goldens were rendered with. Two Chromiums a version apart
 * rasterise text and shadows differently, so a comparison across them measures the
 * renderer rather than the product.
 */
export const PINNED_PLAYWRIGHT = '1.56.1';

/** An https origin: geolocation and other capabilities only exist on a secure one, and
 *  routes are fulfilled before any connection, so no certificate is involved. */
export const SITE_ORIGIN = 'https://hitbut.test';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.json': 'application/json',
};

/**
 * The pinned version is spelled in three places that must agree: here, the dependency in
 * package.json, and the container image CI runs this lane in. Two of them are checkable
 * from here, so they are checked from here — a silent disagreement between them is a
 * goldens diff that only appears on someone else's machine.
 */
function assertPinnedBrowser(): void {
  const installed = createRequire(import.meta.url)('playwright-core/package.json').version as string;
  if (installed !== PINNED_PLAYWRIGHT) {
    throw new Error(
      `the goldens were rendered with playwright ${PINNED_PLAYWRIGHT} and this is ${installed}; ` +
        'a comparison across browser builds measures the renderer, not the product',
    );
  }
  const workflow = readFileSync(path.join(REPO_ROOT, '.github/workflows/product.yml'), 'utf8');
  const image = /mcr\.microsoft\.com\/playwright:v([\d.]+)-/.exec(workflow)?.[1];
  if (image !== PINNED_PLAYWRIGHT) {
    throw new Error(
      `the screen lane pins playwright ${PINNED_PLAYWRIGHT} but .github/workflows/product.yml runs it ` +
        `in the ${image ?? 'unrecognised'} image; CI would compare against a renderer nobody approved`,
    );
  }
}

/**
 * Fontconfig pointed at one directory, holding the two families the site ships. Nothing
 * installed on the machine can reach the page, so a glyph our subsets lack cannot quietly
 * arrive from a font the runner happens to have — where one wider glyph rewraps a line and
 * moves every card below it. The jail cannot be *empty*: a Chromium with no readable font
 * crashes its renderer, which reads as a blank page rather than as a misconfiguration.
 */
function fontJail(): string {
  if (!existsSync(FALLBACK_FONTS)) {
    throw new Error(`no fallback fonts at ${FALLBACK_FONTS} — run \`node dev/tools/vendor-fonts.ts\``);
  }
  mkdirSync(SCRATCH, { recursive: true });
  const alias = (generic: string, family: string) =>
    [
      '  <match target="pattern">',
      `    <test qual="any" name="family"><string>${generic}</string></test>`,
      `    <edit name="family" mode="prepend" binding="strong"><string>${family}</string></edit>`,
      '  </match>',
    ].join('\n');
  const file = path.join(SCRATCH, 'fonts.conf');
  writeFileSync(
    file,
    [
      '<?xml version="1.0"?>',
      '<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">',
      '<fontconfig>',
      `  <dir>${FALLBACK_FONTS}</dir>`,
      `  <cachedir>${path.join(SCRATCH, 'fontcache')}</cachedir>`,
      alias('serif', 'Frank Ruhl Libre'),
      alias('sans-serif', 'Heebo'),
      alias('monospace', 'Heebo'),
      '</fontconfig>',
      '',
    ].join('\n'),
  );
  return file;
}

export async function launchBrowser(): Promise<Browser> {
  assertPinnedBrowser();
  return chromium.launch({
    // Reproducible rasterisation: no hinting, no subpixel text, sRGB, no GPU, and no
    // tile reuse or CPU-tuned drawing routines — the last two make the same page render
    // differently run to run on one machine wherever there is a shadow or a blur.
    args: [
      '--font-render-hinting=none',
      '--disable-lcd-text',
      '--disable-font-subpixel-positioning',
      '--force-color-profile=srgb',
      '--hide-scrollbars',
      '--disable-gpu',
      '--disable-partial-raster',
      '--disable-skia-runtime-opts',
      '--force-device-scale-factor=1',
    ],
    env: { ...process.env, FONTCONFIG_FILE: fontJail() },
  });
}

export type Viewport = { width: number; height: number };

export const DESKTOP: Viewport = { width: 1280, height: 900 };
export const PHONE: Viewport = { width: 390, height: 844 };

export async function newContext(
  browser: Browser,
  api: (pathAndQuery: string) => Promise<{ status: number; headers: Record<string, string>; body: string }>,
  viewport: Viewport,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    // Fixed at context creation and unchangeable afterwards, which is why they are here
    // and not in an init script.
    locale: 'he-IL',
    timezoneId: 'UTC',
    colorScheme: 'light',
  });

  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== SITE_ORIGIN) return route.abort();

    if (url.pathname.startsWith('/api/')) {
      const answer = await api(url.pathname + url.search);
      return route.fulfill({ status: answer.status, headers: answer.headers, body: answer.body });
    }

    const asset = path.join(DIST, url.pathname);
    const file = existsSync(asset) && path.extname(asset) ? asset : path.join(DIST, 'index.html');
    return route.fulfill({
      status: 200,
      headers: { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' },
      body: readFileSync(file),
    });
  });

  await context.addInitScript(
    ({ now }: { now: string }) => {
      // A resting state, so anything that formats "today" is the same today forever.
      const fixed = new Date(now).getTime();
      const RealDate = Date;
      // @ts-expect-error replacing the global on purpose
      globalThis.Date = class extends RealDate {
        constructor(...args: unknown[]) {
          // @ts-expect-error forwarding the real constructor's overloads
          super(...(args.length ? args : [fixed]));
        }
        static now() {
          return fixed;
        }
      };
      globalThis.Math.random = () => 0.42;
      // Zeroing CSS durations stops declarative animation and nothing else: anything
      // driven through element.animate keeps running and a capture races it.
      Element.prototype.animate = function animate() {
        return { finished: Promise.resolve(), cancel() {}, finish() {}, play() {}, pause() {} } as unknown as Animation;
      };
    },
    { now: REFERENCE_NOW },
  );

  return context;
}

/** Waits on something the page itself produced, never on the network going quiet. */
export async function settle(page: Page): Promise<void> {
  await page.waitForSelector('[data-ready="true"]', { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }',
  });
}
