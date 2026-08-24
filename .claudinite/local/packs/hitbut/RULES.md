# hitbut — this repo's own rules

The capture surface for lessons **specific to this repository**. Loaded into every session
through the rules index, so what lands here should be a directive an agent can act on, not a
description of how something works.

A lesson that would hold in another repo does not belong here — propose it to the Claudinite
canon instead, where every repo gets it.

- **A GitHub Actions "Node 20 deprecation" warning names the *action's* own execution
  environment, not the job's `node-version`.** Bumping `node-version` in `actions/setup-node`
  doesn't touch it — bump the flagged action's own major version instead (e.g.
  `actions/checkout@v4` → `@v5`), and check each action independently: they drop Node 20 on
  different schedules (`actions/upload-artifact` needed `@v6`, not `@v5` — see the comment in
  `.github/workflows/product.yml`).

- **When a GitHub Actions check looks anomalously long-running (minutes past its usual pace),
  don't trust `status`/`conclusion` from the checks API — read the job's logs directly.** Those
  fields have been observed stale by double-digit minutes against when the job actually finished.

- **This product's market is Israeli and Hebrew-first.** A market-scope question, a new UI
  surface, or a design canvas that defaults to a US/English framing has already been the wrong
  default twice — once in the initial product research, once in the first design canvas draft,
  both requiring a full rework once corrected.

- **When adding bidirectional UI (Hebrew RTL alongside English LTR), use CSS logical
  properties** (`padding-inline-start`, `border-inline-end`, …) rather than physical
  `left`/`right`, so a pattern copied between an RTL surface and an LTR one can't silently land
  on the wrong side. (Doesn't apply to `src/dashboard/` — the operator console is
  English/LTR-only by design, not bidirectional.)

- **When a user's free-text answer to an `AskUserQuestion` turns out infeasible, say so and
  confirm the fallback — never silently implement the menu's original default instead.**
  Reverting without telling the user leaves them believing their actual request was honored.
