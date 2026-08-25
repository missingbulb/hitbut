# preflight — does production exist yet?

**This task runs no agent.** `agent_model: none`, `code_work: node worker.mjs` — reads
production and reports; creates nothing, changes nothing, safe to run any number of times.

## What it does

Replaces the `preflight` GitHub Actions workflow. Asked for the same way as `provision` —

```
node .claudinite/shared/packs/claudinite-tasks/queue/create-work-item.mjs hitbut/preflight
```

— typically first when a deploy failed, since most deploy failures are a resource or a
secret that is not there.

Runs `npm run preflight` and parks the item `needs-human` + `task:needs-human-action` when
something required is still missing (naming what, in the run log); converges `task:done`
when everything required is in place.

Declares `required_secrets: [CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID]` — without both
configured, the executor parks the item itself, naming them, before code-work ever runs.
