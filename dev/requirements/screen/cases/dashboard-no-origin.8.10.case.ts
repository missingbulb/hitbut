import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

export default {
  title: 'with no API origin the console names the setting and issues no request',
  async run(screen: ScreenContext) {
    const page = await screen.openUnconfigured('/');

    // Nothing was asked for. A relative URL here would resolve to the console's own host,
    // which answers 404 — so the page would report the API refusing when in fact nobody
    // had told it where the API is. Every request the page made is recorded, and none of
    // them may be an API call.
    const asked = await page.evaluate(() =>
      performance.getEntriesByType('resource').map((entry) => entry.name),
    );
    assert.deepEqual(
      asked.filter((url) => url.includes('/api/')),
      [],
      'a console with no configured origin must ask nobody, not ask itself',
    );

    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    assert.match(text, /API_ORIGIN/, 'it has to name the setting that is missing');
    // And must not blame the server for a value nobody supplied.
    assert.doesNotMatch(text, /404/, 'a missing setting is not a status code');

    await screen.shoot(page);
  },
} satisfies Case<ScreenContext>;
