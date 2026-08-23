import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

export default {
  title: 'a trend-change page shows both utterances around the «אבל» mark, with the interval',
  async run(screen: ScreenContext) {
    const page = await screen.open(`/findings/${screen.seeded.findings.housingChange}`);

    // The interval is the finding's claim, and a Latin date inside an RTL line is exactly
    // where bidi reorders the parts into a different date that still looks like one. The
    // golden would not catch it — nothing about "20-01-2025" looks wrong at a glance.
    const text = await page.locator('main').innerText();
    assert.match(text, /2025-01-20/, 'the interval start must read in its own order');
    assert.match(text, /2026-02-11/, 'and so must the end');

    // Two sides and the mark between them: the shape the product is named after.
    assert.equal(await page.locator('.pair__side').count(), 2);

    await screen.shoot(page);
  },
} satisfies Case<ScreenContext>;
