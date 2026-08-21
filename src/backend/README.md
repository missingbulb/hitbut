# backend

Cloudflare Workers. Three responsibilities, kept separable:

- **acquisition** — scraping public statements from sources we do not own, and
  caching the raw payloads before anything interprets them.
- **corpus** — the stored, sourced, citable statements; stable identifiers.
- **analysis** — reading the corpus for contradictions and shifts in position
  over time.

Serves the HTTP API the front end consumes. Must not reference the front end at all;
shared shapes go through the shared contract folder.

Empty for now — the adoption landed the structure, not the implementation.
