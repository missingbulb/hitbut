# hitbut — change record

Every change automatic work makes to this pack, newest first: a prose rule added or removed, a
check created, a rule corrected against a probe or deleted as irrelevant. The row is written in
the same PR as the change it describes, so this file diffs beside it.

A run that changed nothing writes no row — this is the log of what happened to the pack, never a
log of runs.

| Date | Task | Change |
|---|---|---|
| 2026-08-24 | growth-extract | Five prose rules added to `RULES.md`: GitHub Actions Node-deprecation warnings name the action's own runtime, not `node-version`; a stale-looking `status`/`conclusion` field needs a job-logs read, not more polling; the product's Israeli/Hebrew market as the scoping default; CSS logical properties for bidirectional UI; and confirming an infeasible `AskUserQuestion` answer's fallback instead of silently reverting to the menu default. |
