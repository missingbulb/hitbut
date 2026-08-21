# src

hitbut's shipped code, split along the boundary it deploys on.

| Folder | What runs there |
|---|---|
| `backend/` | Cloudflare Workers — scraping public statements, storing the corpus, and the analysis that detects inconsistencies. Serves the HTTP API. |
| `frontend/` | The browsable/searchable site (Cloudflare Pages). Talks to the back end over the HTTP API and nothing else. |
| `shared/` | The contract both sides may use — types and shapes crossing the API boundary. The only folder both may reference. |

`backend/` and `frontend/` must never reference each other: they deploy as two
separate artifacts, so a direct reference would couple two things that ship on
their own schedules. That separation is enforced — see the `barriers` entry in
`.claudinite-checks.json`.

Nothing under `src/` may reference `product-wiki/`: research is not a
requirement until a person promotes it into `product-wiki/product-requirements/`.
