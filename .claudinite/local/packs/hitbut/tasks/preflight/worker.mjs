// The preflight task's whole work (agent_model: none) — code-work runs this
// directly as `node worker.mjs`. See README.md beside this file for what it
// replaces and why.

import { run } from '../shared/cloudflare-run.mjs';

const root = process.env.CLAUDINITE_REPO_ROOT;
if (!root) {
  console.error('CLAUDINITE_REPO_ROOT is not set');
  process.exit(1);
}

const result = await run(root, 'npm', ['run', 'preflight']);
if (!result.ok) {
  console.log('claudinite-needs-human: action — production is not ready; see the log above for what is missing (issue #27)');
  process.exit(1);
}
