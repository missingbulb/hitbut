import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

export default {
  title: 'an anomaly page shows the one utterance that sits apart, and the room it was said in',
  async run(screen: ScreenContext) {
    const page = await screen.open(`/findings/${screen.seeded.findings.rallyAnomaly}`);

    // The golden is what gets approved, but the room is the substance: a page that showed
    // the quote and buried where it was said would be showing a quote and calling it an
    // inconsistency.
    const text = await page.locator('main').innerText();
    assert.match(text, /עצרת/, 'the venue must be on the page');
    assert.match(text, /חברי המפלגה/, 'and who it was addressed to');
    assert.equal(await page.locator('.pair').count(), 0, 'an anomaly has one side, so it does not borrow the pair shape');

    await screen.shoot(page);
  },
} satisfies Case<ScreenContext>;
