// Does the thing we just deployed actually answer? Run at the end of a deploy, against
// the real origins.
//
// Everything the requirements suite proves is proven against a local workerd with local
// D1 and R2. A missing binding, an unapplied migration, a wrong API origin, a
// Pages project serving the wrong directory — each is invisible to that suite and fatal
// in production. This is the smallest set of reads that tells those apart from a healthy
// deployment.
//
// Usage: node dev/tools/smoke.ts --api https://… --site https://…
import { setTimeout as sleep } from 'node:timers/promises';

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const api = (argument('api') ?? process.env.API_ORIGIN ?? '').replace(/\/+$/, '');
const site = (argument('site') ?? process.env.SITE_ORIGIN ?? '').replace(/\/+$/, '');

if (!api || !site) {
  console.error('smoke: needs --api and --site (or API_ORIGIN and SITE_ORIGIN in the environment)');
  process.exit(2);
}

/** A deploy takes a moment to propagate; a first 404 is not yet a failed deploy. */
const ATTEMPTS = 5;
const BACKOFF_MS = 3_000;

type Probe = {
  what: string;
  url: string;
  /** Returns null when the response is what it should be, or the reason it is not. */
  check: (response: Response, body: string) => string | null;
};

const PROBES: Probe[] = [
  {
    what: 'the API serves the corpus',
    url: `${api}/api/v1/figures`,
    check: (response, body) => {
      if (response.status !== 200) return `expected 200, got ${response.status}`;
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        return `expected JSON, got ${body.slice(0, 120)}`;
      }
      const items = (parsed as { items?: unknown }).items;
      return Array.isArray(items) ? null : 'the body has no items array';
    },
  },
  {
    // Proves it is *our* Worker answering and not a platform placeholder or a parked
    // domain, both of which happily return 200 for the route above.
    what: 'the 404 envelope is ours',
    url: `${api}/api/v1/nope`,
    check: (response, body) => {
      if (response.status !== 404) return `expected 404, got ${response.status}`;
      try {
        const code = (JSON.parse(body) as { error?: { code?: string } }).error?.code;
        return code === 'not_found' ? null : `expected error.code "not_found", got ${JSON.stringify(code)}`;
      } catch {
        return `expected the JSON error envelope, got ${body.slice(0, 120)}`;
      }
    },
  },
  {
    what: 'the site is the built site',
    url: `${site}/`,
    check: (response, body) => {
      if (response.status !== 200) return `expected 200, got ${response.status}`;
      if (!body.includes('<div id="app">')) return 'the HTML is not the built index';
      return body.includes('התבטאויות') ? null : 'the page does not carry the wordmark';
    },
  },
];

async function probe({ what, url, check }: Probe): Promise<boolean> {
  let last = 'never attempted';
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'hitbut-smoke' } });
      const failure = check(response, await response.text());
      if (!failure) {
        console.log(`  [ok  ] ${what} — ${url}`);
        return true;
      }
      last = failure;
    } catch (error) {
      last = `request failed: ${String(error)}`;
    }
    if (attempt < ATTEMPTS) await sleep(BACKOFF_MS * attempt);
  }
  console.log(`  [FAIL] ${what} — ${url}`);
  console.log(`         ${last} (after ${ATTEMPTS} attempts)`);
  return false;
}

console.log(`\nhitbut smoke test\n  api:  ${api}\n  site: ${site}\n`);

const outcomes: boolean[] = [];
for (const item of PROBES) outcomes.push(await probe(item));

const failed = outcomes.filter((ok) => !ok).length;
if (failed) {
  console.log(`\n${failed} of ${PROBES.length} probes failed — what shipped is not serving. See issue #36.\n`);
  process.exit(1);
}
console.log(`\nAll ${PROBES.length} probes passed.\n`);
