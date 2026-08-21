# frontend

The site people browse and search (Cloudflare Pages): figures, statements, and
the detected inconsistencies, each shown with its sources.

Reaches the back end over the HTTP API only. Must not reference the back end at all;
shared shapes go through the shared contract folder.

Preact and Vite; six pages, a router of about fifty lines, and no state library. Direction
follows the *content*: a Hebrew page is right-to-left, an English pair renders the same
design left-to-right, and the stylesheet is written in logical properties so one sheet
does both.

The fonts are vendored into `public/fonts/` — `src/fonts.GENERATED.css` is written by
`dev/tools/vendor-fonts.ts` and is not edited by hand. Self-hosting them is what makes the
screenshot goldens comparable across machines, and it keeps the site loading nothing from
a third party.

UI requirements are proven with Playwright driving this front end in headless
Chromium against a local preview, asserting on committed screenshot goldens — see
[`dev/requirements/README.md`](../../dev/requirements/README.md).
