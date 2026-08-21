import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

export default {
  title: 'a statement page shows the quote, its date, its context and a link to the source',
  async run(screen: ScreenContext) {
    await screen.shoot(await screen.open(`/statements/${screen.seeded.statements.lightRailPledge}`));
  },
} satisfies Case<ScreenContext>;
