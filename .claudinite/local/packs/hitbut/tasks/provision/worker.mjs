// The provision task's whole work (agent_model: none) — code-work runs this
// directly as `node worker.mjs`. See README.md beside this file for what it
// replaces and why.

import { spawnSync } from 'node:child_process';
import { run, repoVariable } from '../shared/cloudflare-run.mjs';

const root = process.env.CLAUDINITE_REPO_ROOT;
if (!root) {
  console.error('CLAUDINITE_REPO_ROOT is not set');
  process.exit(1);
}

// Operator parameters ride the item's Context — the only channel a task may take
// them from (`create-work-item hitbut/provision --context dry-run`).
const dryRun = /(^|\n)\s*dry-run\b/i.test(process.env.CLAUDINITE_CONTEXT ?? '');

// The id D1 hands out is the one piece of production that lives in the repo
// rather than in the account, so it goes straight to `main` rather than through
// a review it cannot fail.
function pinDatabaseId() {
  const diff = spawnSync('git', ['diff', '--quiet', '--', 'wrangler.toml'], { cwd: root });
  if (diff.status === 0) {
    console.log('wrangler.toml already carries the real database id — nothing to commit.');
    return true;
  }
  spawnSync('git', ['config', 'user.name', 'github-actions[bot]'], { cwd: root });
  spawnSync('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], { cwd: root });
  spawnSync('git', ['add', 'wrangler.toml'], { cwd: root });
  const commit = spawnSync('git', ['commit', '-m', 'Pin the provisioned D1 database id\n\nRefs #27'], { cwd: root, stdio: 'inherit' });
  if (commit.status !== 0) return false;
  const push = spawnSync('git', ['push', 'origin', 'HEAD:main'], { cwd: root, stdio: 'inherit' });
  if (push.status !== 0) {
    console.log('Could not push the database id to main. The line it needs is in the diff below; commit it by hand and the deploy will work.');
    spawnSync('git', ['--no-pager', 'diff', 'HEAD~1', '--', 'wrangler.toml'], { cwd: root, stdio: 'inherit' });
    return false;
  }
  return true;
}

async function main() {
  const dimensions = await repoVariable('VECTORIZE_DIMENSIONS');
  const provisionArgs = dryRun ? ['run', 'provision', '--', '--dry-run'] : ['run', 'provision'];
  const provision = await run(root, 'npm', provisionArgs, dimensions ? { VECTORIZE_DIMENSIONS: dimensions } : {});

  const pinned = dryRun ? true : pinDatabaseId();

  // This decides the run. The provisioner exits clean when it declines — an
  // unanswered question is not a failure of its own — so without this, a run
  // that created nothing and could ask nothing would report success. The
  // preflight is the honest answer to "did it work", so let it be the answer.
  const preflight = await run(root, 'npm', ['run', 'preflight']);

  if (!provision.ok || !pinned) {
    console.log('claudinite-needs-human: failure — provisioning did not finish cleanly, see the log above');
    process.exit(1);
  }
  if (!preflight.ok) {
    console.log('claudinite-needs-human: action — preflight still reports production is not ready, see the log above for what remains');
    process.exit(1);
  }
  console.log('provision complete — production is ready');
}

main();
