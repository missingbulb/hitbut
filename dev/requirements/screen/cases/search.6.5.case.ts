import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

export default {
  title: 'a search results page marks the query’s word in every hit',
  async run(screen: ScreenContext) {
    // The word appears bare in one statement and with a prefix in another, so the marks
    // show the folding doing its job rather than a plain substring match.
    await screen.shoot(await screen.open(`/search?q=${encodeURIComponent('תקציב')}`));
  },
} satisfies Case<ScreenContext>;
