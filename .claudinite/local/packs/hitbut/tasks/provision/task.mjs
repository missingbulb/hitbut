// hitbut task: provision — replaces the `provision` GitHub Actions workflow.
// See README.md beside this file for what it does.
//
// `agent_model: 'none'` + code_work: the whole pass is deterministic code the
// executor runs as code-work — no agent phase, fully automatic.

export default {
  id: 'provision',
  frequency: 'manual',
  precondition_signals: [],
  agent_model: 'none',
  expected_outcome: 'none',
  code_work: 'node worker.mjs',
  code_work_timeout: 900,
  required_secrets: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],

  // Creating account resources spends money in someone's account, which is a
  // decision a person makes by asking for this item — never a schedule. Once
  // asked for, there is nothing further to decide: run it.
  precondition() {
    return { run: true, reason: 'a person asked for whatever production is missing to be created' };
  },
};
