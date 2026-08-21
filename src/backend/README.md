# backend

Cloudflare Workers. Three responsibilities, kept separable:

- **acquisition** — scraping public statements from sources we do not own, and
  caching the raw payloads before anything interprets them.
- **corpus** — the stored, sourced, citable statements; stable identifiers.
- **analysis** — reading the corpus for contradictions and shifts in position
  over time.

One deploy, three entry points: `index.ts` wires the cron trigger to acquisition, the
queue consumer to analysis, and the fetch handler to `api/`. `corpus/` is the only module
the other three import.

`env.ts` declares the handful of platform methods this Worker uses, rather than depending
on the published Workers types — they collide with the DOM types the site needs.

Must not reference the front end at all; shared shapes go through the shared contract
folder. What runs where, and why this shape, is
[`docs/architecture/DESIGN.md`](../../docs/architecture/DESIGN.md).
