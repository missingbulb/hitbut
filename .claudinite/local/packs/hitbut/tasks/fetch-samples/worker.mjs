// Runs the sample fetch and delivers what came back on a pull request.
//
// The fetching itself is `dev/tools/fetch-samples.ts`, run as it would be by hand, so
// there is one description of how a candidate is fetched rather than a second copy here.
// This worker is the part that only makes sense inside a run: reading the operator's
// parameters off the item, and turning whatever landed in the working tree into a PR.
//
// Raw bytes from a site we do not own are exactly what nobody has read yet, so the
// delivery carries no automerge and the PR waits for a person.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deliverGenerated } from '../../../../../shared/packs/claudinite-tasks/deliver-generated.mjs';

const TASK = 'hitbut/fetch-samples';
const BRANCH_PREFIX = 'samples';

/**
 * The operator's parameters, which ride the item's Context — the only channel a task may
 * take them from. `force` re-fetches candidates already saved; `only` narrows the run to
 * named candidate ids.
 */
export function argumentsFrom(context) {
  const args = [];
  for (const line of (context ?? '').split('\n')) {
    const [key, ...rest] = line.replace(/^[-*]\s*/, '').split(':');
    const value = rest.join(':').trim();
    if (key.trim().toLowerCase() === 'force' && /^(true|yes)$/i.test(value)) args.push('--force');
    if (key.trim().toLowerCase() === 'only' && value) args.push('--only', value);
  }
  return args;
}

/** Paths under the samples tree the fetch changed or created, as git sees them. */
export function changedPaths(porcelain) {
  return porcelain
    .split('\n')
    .filter(Boolean)
    // Rename entries never occur here: the tool writes and overwrites, it never moves.
    .map((line) => line.slice(3).trim())
    .filter((path) => path.startsWith('dev/samples/'));
}

async function main() {
  const root = process.env.CLAUDINITE_REPO_ROOT;
  const repo = process.env.CLAUDINITE_REPO;
  const base = process.env.CLAUDINITE_DEFAULT_BRANCH;
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('claudinite-needs-human: action — GITHUB_TOKEN is not set, so nothing can be delivered');
    process.exit(1);
  }

  const args = argumentsFrom(process.env.CLAUDINITE_CONTEXT);
  const fetched = spawnSync('node', ['dev/tools/fetch-samples.ts', ...args], { cwd: root, stdio: 'inherit' });
  if (fetched.status !== 0) {
    // A candidate refusing us is recorded by the tool and is not this: reaching here
    // means the tool itself could not run.
    console.error(`claudinite-needs-human: failure — the sample fetch exited ${fetched.status}`);
    process.exit(1);
  }

  const porcelain = execFileSync('git', ['status', '--porcelain', '--', 'dev/samples'], { cwd: root, encoding: 'utf8' });
  const paths = changedPaths(porcelain);
  if (paths.length === 0) {
    // Every candidate was already saved: the work ran and found nothing to deliver.
    console.log('nothing came back that is not already committed — no pull request to open');
    return;
  }

  const files = Object.fromEntries(paths.map((path) => [path, readFileSync(join(root, path), 'utf8')]));
  const pr = await deliverGenerated({
    root,
    repo,
    base,
    token,
    branchPrefix: BRANCH_PREFIX,
    stamp: new Date().toISOString().slice(0, 10),
    files,
    task: TASK,
    message: 'Reconnaissance samples from the candidate list',
    title: 'Reconnaissance samples',
    body: [
      'Raw payloads from the candidate source URLs, for the reconnaissance in #32 to read',
      'offline. What each candidate answered — including the ones that refused us — is in',
      '`dev/samples/report.GENERATED.md` in this diff.',
      '',
      'These are bytes from sites hitbut does not own and nobody has read yet, which is why',
      'they arrive as a pull request rather than on the default branch.',
      '',
      'Refs #208, #32',
    ].join('\n'),
  });
  console.log(
    `${paths.length} file(s) delivered — ${pr.reused ? 'updated' : 'opened'} PR ` +
      `${pr.number !== null ? `#${pr.number}` : `on ${pr.branch}`}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`fetch-samples failed: ${error.message}`);
    process.exit(1);
  });
}
