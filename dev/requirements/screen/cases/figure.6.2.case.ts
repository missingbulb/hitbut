import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

export default {
  title: 'a figure page shows the profile, the counts, the topics and the marked timeline',
  async run(screen: ScreenContext) {
    await screen.shoot(await screen.open(`/figures/${encodeURIComponent(screen.seeded.figures.ilana)}`));
  },
} satisfies Case<ScreenContext>;
