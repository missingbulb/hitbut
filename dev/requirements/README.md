# The requirements harness

[`requirements.md`](requirements.md) is the spec. This is what runs it.

Every numbered leaf in the spec is claimed by exactly one case, in the folder of the kind
that can actually observe what the leaf asserts. The claim is the **file name**:
`<slug>.<leaf-id>.case.ts`. There is no registration step and no id inside the file — the
name is the whole of it, and [`coverage.test.ts`](coverage.test.ts) fails the build if the
correspondence breaks in either direction.

## The kinds

| Kind | What it can see | How a case runs |
|---|---|---|
| `logic` | a pure product rule | the shipped code, called directly |
| `behavior` | a driven action and its consequence | the shipped code over recording fakes |
| `server` | a rule the HTTP boundary enforces | the shipped Worker on `workerd`, from the committed `wrangler.toml` |
| `screen` | what a page looks like | the built site in a pinned Chromium, against a committed screenshot |

Adding a kind is a drop: declare it in [`registry.ts`](registry.ts), create
`<kind>/cases/` and `<kind>/run.test.ts`, and the gate, the runners and the gallery pick
it up with no edit to any of them.

## Running it

```sh
npm test              # logic + behavior + both gates — the inner loop, seconds
npm run test:server   # the real Worker; needs no Cloudflare account
npm run test:screen   # the browser lane; slowest, so it is its own lane
npm run test:all      # everything
```

## Changing what a page looks like

The committed PNG under a `screen` leaf is the **owner's approval record** of that page.
An agent may propose one for a brand-new leaf; nobody edits a committed one to make a
failing case pass.

- A case fails → look at the pictures it wrote to `failures/` (expected, actual, diff)
  and decide whether the product or the expectation is wrong. If the answer is the
  expectation, that is the owner's call, made on the diff.
- The change is intended → `npm run requirements:refresh` re-renders every golden **and**
  rewrites the gallery in `requirements.md`, so the two cannot skew. The new images ride
  the pull request for review.

The comparison is exact. A tolerance would let unreviewed drift through, so where a
rendering is unstable the fix is the determinism — the pinned browser build, the font
jail, the fixed clock, the fakes — and not a threshold.

## What keeps a screenshot the same everywhere

- **The browser build is pinned.** Two Chromiums a version apart rasterise text
  differently; the lane refuses to run on any other, naming the one the goldens were made
  with.
- **The page's world is replaced.** The site is served from `dist` and `/api/v1` from the
  running Worker, both fulfilled at the browser; anything else is aborted, so a new
  external dependency breaks the run instead of quietly making it non-hermetic.
- **Fonts come from a jail.** One directory, holding the two families the site ships.
  Nothing installed on the machine can reach the page — one wider fallback glyph rewraps a
  line and moves every card below it.
- **Time and randomness are fixed**, at one reference instant shared with the fixtures.

## The sample corpus

[`shared/fixtures.ts`](shared/fixtures.ts) is the world every lane runs against. Every
figure, quote, date and publisher in it is invented, and the publishers say so — nothing
here attributes a statement to a real person, and a committed screenshot cannot be
mistaken for a record of anything real.
