import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

export default {
  title: 'an English finding renders the whole page left to right, with the mark reading “but”',
  async run(screen: ScreenContext) {
    // Direction follows the content, not a site-wide setting. The budget pair is in
    // English, so the page — masthead, pair, rationale — is left to right.
    await screen.shoot(await screen.open(`/findings/${screen.seeded.findings.budgetChange}`));
  },
} satisfies Case<ScreenContext>;
