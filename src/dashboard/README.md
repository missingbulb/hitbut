# dashboard

The operator console: what the corpus holds, and what each source module last did. A
static Preact app on GitHub Pages, published by `.github/workflows/dashboard.yml`, and a
separate artifact from the public site — different host, different audience.

It reads two routes over the same public HTTP API a reader's browser uses. `/status` needs
no credential — every number in it is reachable by walking the corpus API. `/operations`
does, and the token lives in the operator's browser: a static page cannot hold a secret,
so it is supplied by whoever is looking rather than shipped in the bundle.

Nothing here counts a visitor to the site. Its numbers come from what the server already
knows about itself, which is why it needed no write surface — see § 8 of
[the requirements](../../dev/requirements/requirements.md) and the reasoning in
[`DESIGN.md`](../../docs/architecture/DESIGN.md).

`npm run dev:dashboard` runs it; `npm run build:dashboard` builds it. Both take the API
origin from `VITE_API_ORIGIN`.
