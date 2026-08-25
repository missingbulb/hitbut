// hitbut task: deploy — replaces the `ship main` job that used to live in
// .github/workflows/product.yml. See README.md beside this file for what it does.
//
// `agent_model: 'none'` + code_work: the whole pass is deterministic code the
// executor runs as code-work — no agent phase, fully automatic.

export default {
  id: 'deploy',
  frequency: 'manual',
  precondition_signals: [],
  agent_model: 'none',
  expected_outcome: 'none',
  code_work: 'node worker.mjs',
  // Two wrangler deploys (up to 10 minutes each, per dev/tools/deploy.ts), a
  // migration, a site build and a smoke test — generous, well under the
  // executor's 60-minute claim leash.
  code_work_timeout: 2400,
  required_secrets: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],

  // Unconditional: this item exists only because something already decided a
  // deploy was due (a green requirements suite on `main`) — the precondition
  // has nothing further to ask.
  precondition() {
    return { run: true, reason: 'woken by a green requirements suite on main — ships the Worker and the site production runs against' };
  },
};
