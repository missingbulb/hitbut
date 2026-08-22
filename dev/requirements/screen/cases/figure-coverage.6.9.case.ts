import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

export default {
  title: 'a figure page states which sources its record covers and from when',
  async run(screen: ScreenContext) {
    const page = await screen.open(`/figures/${encodeURIComponent(screen.seeded.figures.ilana)}`);

    // The golden is what gets approved, but the caveat is the substance: without the
    // sentence, the list of sources reads as trivia rather than as the reason the timeline
    // above it is not the whole record.
    const text = await page.locator('main').innerText();
    assert.match(text, /מה הרשומה הזו מכסה/, 'the page must say what the record covers');
    assert.match(text, /היעדרם אינו אומר שלא נאמרו/, 'and that what is missing is not evidence of silence');
    assert.match(text, /sample-protocols/, 'naming the source that reaches this figure');

    await screen.shoot(page);
  },
} satisfies Case<ScreenContext>;
