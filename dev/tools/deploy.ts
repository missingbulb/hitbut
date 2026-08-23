// Ships one half of the product and says where it landed.
//
// The site is static, so the API's origin is baked into it at build time — and for a long
// time that meant the first deploy could not work: the Worker did not exist yet, so nobody
// could know its origin, so a human pasted it in between two runs. None of that was
// necessary. Both origins are knowable the moment their half is deployed: the Worker's from
// what `wrangler deploy` prints, the site's from the Pages project itself. So this deploys,
// reads the origin back, and hands it to the next step through `GITHUB_ENV`.
//
// How an origin is read out of that output is `origins.ts`.
//
// Usage: `node dev/tools/deploy.ts api` | `node dev/tools/deploy.ts site`
import { appendFileSync } from 'node:fs';
import { PAGES_PROJECT, wrangler } from './cloudflare.ts';
import { deployedSite, deployedWorker, overrideFrom, projectSite, type Origin } from './origins.ts';

const half = process.argv[2];
if (half !== 'api' && half !== 'site') {
  console.error('deploy: takes "api" or "site"');
  process.exit(2);
}

const DEPLOY_TIMEOUT_MS = 600_000;

function deployApi(): Origin {
  const run = wrangler(['deploy'], DEPLOY_TIMEOUT_MS);
  console.log(run.output);
  if (!run.ok) {
    console.error(`::error::wrangler deploy failed — ${run.reason}`);
    process.exit(1);
  }
  const origin = overrideFrom('API_ORIGIN', process.env.API_ORIGIN) ?? deployedWorker(run.output);
  if (!origin) {
    console.error("::error::The Worker deployed, but its origin was not in wrangler's output and no");
    console.error('::error::API_ORIGIN repository variable is set. Set API_ORIGIN to the origin it should');
    console.error('::error::be reachable at (a custom domain, or the workers.dev URL above) and re-run.');
    process.exit(1);
  }
  return origin;
}

function deploySite(): Origin {
  const run = wrangler(
    ['pages', 'deploy', 'src/frontend/dist', '--project-name', PAGES_PROJECT, '--branch', 'main'],
    DEPLOY_TIMEOUT_MS,
  );
  console.log(run.output);
  if (!run.ok) {
    console.error(`::error::wrangler pages deploy failed — ${run.reason}`);
    process.exit(1);
  }
  const listed = wrangler(['pages', 'project', 'list', '--json'], 90_000);
  const origin =
    overrideFrom('SITE_ORIGIN', process.env.SITE_ORIGIN) ??
    (listed.ok ? projectSite(listed.output, PAGES_PROJECT) : null) ??
    deployedSite(run.output, PAGES_PROJECT);
  if (!origin) {
    console.error('::error::The site deployed, but its production origin could not be read back from the');
    console.error(`::error::${PAGES_PROJECT} Pages project. Set the SITE_ORIGIN repository variable and re-run.`);
    process.exit(1);
  }
  return origin;
}

const origin = half === 'api' ? deployApi() : deploySite();
const variable = half === 'api' ? 'API_ORIGIN' : 'SITE_ORIGIN';

console.log(`\n${variable}=${origin.url}  (from ${origin.how})\n`);
if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `${variable}=${origin.url}\n`);
