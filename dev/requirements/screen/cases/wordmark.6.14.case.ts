import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

export default {
  title: 'the wordmark sets התבט in the old face, eroded, and אויות in the modern one, clean',
  async run(screen: ScreenContext) {
    // The lockup itself, not the page around it: the leaf is about the letterforms, and a
    // full page renders them 30px tall in a corner.
    await screen.shoot(await screen.open('/'), '.wordmark');
  },
} satisfies Case<ScreenContext>;
