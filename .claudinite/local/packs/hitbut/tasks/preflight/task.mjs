// hitbut task: preflight — replaces the `preflight` GitHub Actions workflow.
// See README.md beside this file for what it does.
//
// `agent_model: 'none'` + code_work: the whole pass is deterministic code the
// executor runs as code-work — no agent phase, fully automatic.

export default {
  id: 'preflight',
  frequency: 'manual',
  precondition_signals: [],
  agent_model: 'none',
  expected_outcome: 'none',
  code_work: 'node worker.mjs',
  code_work_timeout: 300,
  required_secrets: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],

  // Read-only and safe any number of times — nothing to decide but "yes".
  precondition() {
    return { run: true, reason: 'a person asked whether production is ready to deploy to' };
  },
};
