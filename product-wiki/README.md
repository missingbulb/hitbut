# product-wiki

The agent-maintained research space for hitbut: what the market looks like, who
the users are, and what the alternatives already do. Research lives here as
cited wiki pages that grow in place over time — compiled once, refined by later
passes, never silently rewritten.

## Why it is walled off from the code

Everything under `product-wiki/` is *research*: evidence gathered about the
world, not decisions this project has committed to. Code under `src/` must never
reference it, and nothing here may reference the code — so an unreviewed finding
can never become an implicit requirement by citation alone. The
`product-wiki-isolation` barrier enforces that wall.

There is exactly one reviewed crossing point.

## Layout

| Path | What it is |
|---|---|
| `product-requirements/` | the human-reviewed sink — the one part of `product-wiki/` the rest of the repo may reference. Never auto-grown. |
| `sample-data/` | small illustrative assets a wiki claim points to. Never test fixtures. |
| anything else | wiki space: one folder per wiki, each with a `README.md`, any nesting. |

A wiki page is a `README.md` at depth ≥ 2 under `product-wiki/` outside the two
reserved subtrees. The folder is the classifier — there is no manifest to drift.

## What every wiki page carries

`## Key insights` first (up to seven terse bullets, ≤140 chars each — what the
research *found*), then the body, then `## Sources` with real URLs,
`## Open questions` (the backlog the next pass works from), and `## Growth log`
(dated bullets, appended per pass).

## Growth

The product-wiki pack's weekly scheduled task reads these pages, researches what
their own open questions flag, writes back cited, and opens an unmerged PR. Most
passes correctly change nothing. In-session, the owner phrase "grow the product
wiki" runs the same worker.

## Planned wikis

No wiki pages are seeded yet — the initial research scan was deliberately
deferred at adoption. The research scope recorded in the adoption interview
(`.claudinite-checks.json`, the `product-wiki` entry's `answers`) names what the
first pass covers:

- **market landscape** — civic accountability / fact-checking tech, surveying
  public fact-checkers, civic-data and transparency platforms, commercial media
  monitoring, and the manual-search status quo.
- **user research** — the four segments: general public, journalists and
  fact-checkers, researchers and academics, campaign and advocacy staff.
- **competitor landscape** — the named alternatives, before a positioning read
  is taken.
