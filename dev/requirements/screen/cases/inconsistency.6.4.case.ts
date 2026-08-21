import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

export default {
  title: 'an inconsistency page shows both statements around the «אבל» mark, with the rationale',
  async run(screen: ScreenContext) {
    await screen.shoot(await screen.open(`/inconsistencies/${screen.seeded.judgments.lightRail}`));
  },
} satisfies Case<ScreenContext>;
