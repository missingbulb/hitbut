import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

export default {
  title: 'an utterance page shows what was said, when, where, and every document that reported it',
  async run(screen: ScreenContext) {
    // The pledge, because three outlets carried it and one of them trimmed it — so the
    // page has to show the count, each source, and the wording that differs.
    await screen.shoot(await screen.open(`/utterances/${screen.seeded.utterances.lightRailPledge}`));
  },
} satisfies Case<ScreenContext>;
