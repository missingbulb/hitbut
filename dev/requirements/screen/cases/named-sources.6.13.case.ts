import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

/** Every surface that shows a quote, and the publisher each must name beside it. */
const SURFACES = [
  { what: 'the figure timeline', path: (screen: ScreenContext) => `/figures/${encodeURIComponent(screen.seeded.figures.ilana)}` },
  { what: 'the search results', path: () => `/search?q=${encodeURIComponent('הרכבת')}` },
  { what: 'the home page', path: () => '/' },
];

export default {
  title: 'every displayed quote names the publication it was taken from',
  async run(screen: ScreenContext) {
    for (const surface of SURFACES) {
      const page = await screen.open(surface.path(screen));
      const text = await page.locator('main').innerText();

      // A quote with no visible publisher is our word for what somebody said.
      const quotes = await page.locator('.quote').count();
      assert.ok(quotes > 0, `${surface.what} shows no quotes, so it is not testing anything`);
      assert.ok(
        await page.locator('.carriers').count() > 0,
        `${surface.what} shows ${quotes} quote(s) with no publisher named beside them`,
      );
      assert.match(text, /לדוגמה|Sample/, `${surface.what} does not name a publication`);
    }

    // Where three outlets carried one utterance, all three are named — which outlets
    // carried something is itself part of the record. Located by its own quote rather than
    // by position: the timeline is newest first and this one is the oldest.
    const timeline = await screen.open(`/figures/${encodeURIComponent(screen.seeded.figures.ilana)}`);
    const pledge = timeline.locator('.card', { hasText: 'ולו שקל אחד מהרכבת הקלה' });
    assert.equal(await pledge.count(), 1);
    const carried = await pledge.locator('.carriers').innerText();
    assert.equal(carried.split('·').length, 3, 'all three publications, not one of them and not a count');

    await screen.shoot(timeline);
  },
} satisfies Case<ScreenContext>;
