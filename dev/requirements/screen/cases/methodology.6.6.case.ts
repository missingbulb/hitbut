import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

export default {
  title: 'the methodology page says what detection confirms, what it does not, and how to report an error',
  async run(screen: ScreenContext) {
    const page = await screen.open('/methodology');

    // The golden is what the owner approves, but the honest-gap sentence is the substance
    // of this requirement — a text assertion catches its removal even if someone refreshes
    // the image without reading it.
    const text = await page.locator('main').innerText();
    assert.match(text, /הוא לא יודע מה הדובר/, 'the page must say the model does not know what was meant');
    assert.match(text, /והוא יכול לטעות/, 'and that it can be wrong');
    assert.equal(await page.locator('a[href*="issues"]').count(), 1, 'and carry a way to report an error');

    await screen.shoot(page);
  },
} satisfies Case<ScreenContext>;
