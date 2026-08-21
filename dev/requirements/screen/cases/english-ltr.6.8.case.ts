import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

export default {
  title: 'an English pair renders the whole page left to right, with the mark reading “but”',
  async run(screen: ScreenContext) {
    await screen.shoot(await screen.open(`/inconsistencies/${screen.seeded.judgments.budget}`));
  },
} satisfies Case<ScreenContext>;
