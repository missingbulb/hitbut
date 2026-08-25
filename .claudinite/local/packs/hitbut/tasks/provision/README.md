# provision — creates whatever production is missing

**This task runs no agent.** `agent_model: none`, `code_work: node worker.mjs` — the whole
pass is [`worker.mjs`](worker.mjs); there is no agent phase.

## What it does

Replaces the `provision` GitHub Actions workflow. Deliberately not woken by anything: a
person (or a session acting for them) asks for it —

```
node .claudinite/shared/packs/claudinite-tasks/queue/create-work-item.mjs hitbut/provision
```

— since creating account resources spends money and is a decision, unlike deploying to
resources that already exist.

Runs the same idempotent `npm run provision` the workflow did, plus the
`VECTORIZE_DIMENSIONS` repository variable (read via the GitHub API, since it's a variable,
not a secret) and the `wrangler.toml` database-id pin — committed and pushed straight to
`main`, no review: whatever D1 handed out is the only correct value. Always ends with a
preflight, so a run that created nothing still reports where production stands.

Pass `dry-run` as a `--context` line to only say what would be created:
`create-work-item.mjs hitbut/provision --context dry-run`.

Declares `required_secrets: [CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID]` — without both
configured, the executor parks the item `needs-human` + `task:needs-human-action` naming
what's missing, and code-work never runs.
