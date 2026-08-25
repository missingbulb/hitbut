// The deploy task's whole work (agent_model: none) — code-work runs this
// directly as `node worker.mjs`. See README.md beside this file for what it
// replaces and why.

import { run, repoVariable } from '../shared/cloudflare-run.mjs';

const root = process.env.CLAUDINITE_REPO_ROOT;
if (!root) {
  console.error('CLAUDINITE_REPO_ROOT is not set');
  process.exit(1);
}

// `dev/tools/deploy.ts` always logs `${variable}=${origin.url}` on its own line,
// GITHUB_ENV or not — read it back off the captured stdout rather than round
// tripping through a file.
const originFrom = (stdout, variable) => new RegExp(`^${variable}=(\\S+)`, 'm').exec(stdout)?.[1] ?? null;

function fail(kind, message) {
  console.log(`claudinite-needs-human: ${kind} — ${message}`);
  process.exit(1);
}

async function main() {
  // Turns "the deploy failed somewhere in wrangler" into a named missing
  // resource. Everything it can report missing is one run of the `provision`
  // task away.
  const preflight = await run(root, 'npm', ['run', 'preflight']);
  if (!preflight.ok) fail('action', 'preflight reports production is not ready to deploy to — see the log above for what is missing');

  const migrate = await run(root, 'npm', ['run', 'corpus:migrate:remote']);
  if (!migrate.ok) fail('failure', 'the corpus migration failed');

  // Each half reads its own origin back and hands it to the next, so the site is
  // built against the API that was just deployed and the smoke test knows where
  // to look. A repository variable is an override for a custom domain, not
  // something the first deploy needs.
  const apiOverride = await repoVariable('API_ORIGIN');
  const apiDeploy = await run(root, 'npm', ['run', 'deploy:api'], apiOverride ? { API_ORIGIN: apiOverride } : {});
  if (!apiDeploy.ok) fail('failure', 'deploying the Worker failed');
  const apiOrigin = originFrom(apiDeploy.stdout, 'API_ORIGIN');
  if (!apiOrigin) fail('failure', 'the Worker deployed but its origin could not be read back');

  const build = await run(root, 'npm', ['run', 'build:site'], { VITE_API_ORIGIN: apiOrigin });
  if (!build.ok) fail('failure', 'building the site against the deployed API failed');

  const siteOverride = await repoVariable('SITE_ORIGIN');
  const siteDeploy = await run(root, 'npm', ['run', 'deploy:site'], siteOverride ? { SITE_ORIGIN: siteOverride } : {});
  if (!siteDeploy.ok) fail('failure', 'deploying the site failed');
  const siteOrigin = originFrom(siteDeploy.stdout, 'SITE_ORIGIN');
  if (!siteOrigin) fail('failure', 'the site deployed but its origin could not be read back');

  // Everything the requirements suite proves is proven against a local workerd.
  // This is the only step that reads what actually shipped.
  const smoke = await run(root, 'npm', ['run', 'smoke'], { API_ORIGIN: apiOrigin, SITE_ORIGIN: siteOrigin });
  if (!smoke.ok) fail('failure', 'the smoke test failed against what just shipped');

  console.log(`deploy complete — api ${apiOrigin}, site ${siteOrigin}`);
}

main();
