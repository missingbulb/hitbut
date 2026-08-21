import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';
import { PHONE } from '../harness.ts';

export default {
  title: 'at phone width the two statements stack with the mark between them',
  async run(screen: ScreenContext) {
    await screen.shoot(await screen.open(`/inconsistencies/${screen.seeded.judgments.lightRail}`, PHONE));
  },
} satisfies Case<ScreenContext>;
