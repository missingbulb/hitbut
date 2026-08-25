# deploy — ships `main`

**This task runs no agent.** `agent_model: none`, `code_work: node worker.mjs` — the whole
pass is [`worker.mjs`](worker.mjs), run directly by code-work; there is no agent phase.

## What it does

Replaces the `ship main` job that used to live in `.github/workflows/product.yml`. Woken
once a push to `main` passes the requirements suite — `.github/workflows/product.yml`'s
`checks` and `screen` jobs stay ordinary GitHub Actions (they gate pull requests too, which
a task cannot do), and its `wake-deploy` job files this task's work item once they're green.

One pass: preflight → migrate the corpus schema remotely → deploy the Worker → build the
site against the origin the Worker just reported → deploy the site → smoke test against
both. Each half's origin is read back from what it deployed and threaded to the next step
in the same process, replacing the old job's `GITHUB_ENV` hand-off — `dev/tools/deploy.ts`
did not need to change. `API_ORIGIN` / `SITE_ORIGIN` repository variables still override a
derived origin for a custom domain; read via the GitHub API, since a variable is not a
secret and `required_secrets` cannot carry it.

Declares `required_secrets: [CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID]` — without both
configured, the executor parks the item `needs-human` + `task:needs-human-action` naming
what's missing, and code-work never runs at all.

A failing preflight or a failing smoke test parks the item `needs-human` with a
`claudinite-needs-human` marker naming which and why (`writing-tasks`' "a failing worker
may say why it failed").
