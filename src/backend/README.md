# backend

Cloudflare Workers. Six modules, kept separable, in the order a passage moves through them:

- **acquisition** — fetching documents from sources we do not own, and caching the raw
  payload before anything interprets it.
- **backfill** — the same work over an archive instead of the moving edge, in finite slices
  so one bad slice costs one retry.
- **ingestion** — one passage all the way in: merge into an utterance, embed it, assign it
  to a cluster, place it on that cluster's axis.
- **corpus** — the stored, sourced, citable utterances and attestations; stable identifiers.
- **detection** — reading one persona's own stance series for anomalies and change points.
- **api** — the public read-only surface.

One deploy, two entry points: `index.ts` wires the scheduled handler to acquisition,
ingestion and detection, and the fetch handler to `api/`. `corpus/` is the only module the
others import from each other.

`raw-keys.ts` owns the layout of the R2 raw bucket, which has two key shapes for two
deliberate reasons — it says which and why.

`env.ts` declares the handful of platform methods this Worker uses, rather than depending
on the published Workers types — they collide with the DOM types the site needs.

Must not reference the front end at all; shared shapes go through the shared contract
folder. What runs where, and why this shape, is
[`docs/architecture/DESIGN.md`](../../docs/architecture/DESIGN.md).
