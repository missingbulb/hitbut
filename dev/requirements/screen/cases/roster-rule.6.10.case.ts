import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

export default {
  title: 'the methodology page publishes the test each tracked person meets',
  async run(screen: ScreenContext) {
    const page = await screen.open('/methodology');

    const text = await page.locator('main').innerText();
    assert.match(text, /את מי אנחנו עוקבים/, 'the page must say who is tracked');
    assert.match(text, /איננו עוקבים אחרי אנשים פרטיים/, 'and state the boundary the roster does not cross');

    // One entry per tracked person, each carrying its own test — a single blanket sentence
    // would be the arbitrary list this requirement exists to rule out.
    const entries = page.locator('.roster__entry');
    assert.equal(await entries.count(), 3, 'every figure on the roster appears');
    for (let index = 0; index < 3; index++) {
      const why = (await entries.nth(index).locator('.roster__why').innerText()).trim();
      assert.ok(why.length > 0, `roster entry ${index} is published without its test`);
    }

    await screen.shoot(page);
  },
} satisfies Case<ScreenContext>;
