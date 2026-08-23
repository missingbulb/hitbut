import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

export default {
  title: 'a finding page carries the detection caveat itself, not only a link to it',
  async run(screen: ScreenContext) {
    const page = await screen.open(`/findings/${screen.seeded.findings.housingChange}`);

    // The sentence, on the page. A reader who has just been shown that a named person
    // contradicted themselves is the reader least likely to go looking for it elsewhere.
    const text = await page.locator('main').innerText();
    assert.match(text, /הוא לא יודע מה הדובר התכוון/, 'the model does not know what was meant');
    assert.match(text, /הוא יכול לטעות/, 'and it can be wrong');
    assert.match(text, /לא מסקנה סופית/, 'and a flag is not a conclusion');
    assert.equal(await page.locator('.caveat').count(), 1);

    // And it is not the rationale wearing a different hat: the rationale is what the model
    // said, the caveat is what the model cannot know, and they are separate blocks.
    assert.equal(await page.locator('.rationale').count(), 1);

    await screen.shoot(page);
  },
} satisfies Case<ScreenContext>;
