# frontend

The site people browse and search (Cloudflare Pages): figures, statements, and
the detected inconsistencies, each shown with its sources.

Reaches the back end over the HTTP API only. Must not reference the back end at all;
shared shapes go through the shared contract folder.

UI requirements are proven with Playwright driving this front end in headless
Chromium against a local preview, asserting on committed screenshot goldens.

Empty for now — the adoption landed the structure, not the implementation.
