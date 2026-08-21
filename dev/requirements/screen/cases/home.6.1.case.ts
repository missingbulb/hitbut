import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

export default {
  title: 'the home page leads with the search, then what was flagged, then the figures',
  async run(screen: ScreenContext) {
    await screen.shoot(await screen.open('/'));
  },
} satisfies Case<ScreenContext>;
