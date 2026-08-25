# hitbut

<!-- claudinite:packs -->
![basics](../missingbulb/claudinite/packs/basics/badge.svg "basics") ![claudinite-lifecycle](../missingbulb/claudinite/packs/claudinite-lifecycle/badge.svg "claudinite-lifecycle") ![barriers](../missingbulb/claudinite/packs/barriers/badge.svg "barriers") ![git-github](../missingbulb/claudinite/packs/git-github/badge.svg "git-github") ![claude-code-web-users-support](../missingbulb/claudinite/packs/claude-code-web-users-support/badge.svg "claude-code-web-users-support") ![claudinite-growth](../missingbulb/claudinite/packs/claudinite-growth/badge.svg "claudinite-growth") ![tidy-repo](../missingbulb/claudinite/packs/tidy-repo/badge.svg "tidy-repo") ![product-wiki](../missingbulb/claudinite/packs/product-wiki/badge.svg "product-wiki") ![spec-driven-product](../missingbulb/claudinite/packs/spec-driven-product/badge.svg "spec-driven-product") ![executable-requirements](../missingbulb/claudinite/packs/executable-requirements/badge.svg "executable-requirements") ![web-scraping](../missingbulb/claudinite/packs/web-scraping/badge.svg "web-scraping") ![node](../missingbulb/claudinite/packs/node/badge.svg "node") ![headless-browser](../missingbulb/claudinite/packs/headless-browser/badge.svg "headless-browser")<!-- /claudinite:packs -->
Website that tracks public statements by public figures and highlights inconsistencies

**התבטאויות** — a sourced record of what Israeli public figures have said, each statement
kept with the document it came from, and, inside that record, the places where it does not
add up. The corpus is the product; inconsistency detection is one lens over it.

| Where | What |
|---|---|
| [`dev/requirements/requirements.md`](dev/requirements/requirements.md) | what the product must do, leaf by leaf — and the gallery of what it actually renders |
| [`docs/architecture/DESIGN.md`](docs/architecture/DESIGN.md) | what runs where, and why this shape |
| [`src/`](src/README.md) | the Worker back end, the Pages front end, and the contract between them |
| [`product-wiki/`](product-wiki/README.md) | the market, user and competitor research, kept apart from the code |

```sh
npm ci
npm test              # the inner loop: pure rules and driven behaviour, seconds
npm run test:server   # the shipped Worker on workerd — no Cloudflare account needed
npm run test:screen   # the built site in a pinned browser, against committed screenshots
npm run dev:api       # wrangler, locally
npm run dev:site      # vite, locally
```

Nothing runs against a Cloudflare account yet. Getting one is
[#27](https://github.com/missingbulb/hitbut/issues/27): paste two repository secrets, run
the *provision* task — it creates every resource the account needs and stops rather
than guess at anything it cannot confirm — and the *preflight* task says what, if
anything, is still missing. What green here does *not* prove is
[#28](https://github.com/missingbulb/hitbut/issues/28).
