import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';

export default {
  title: 'refused operations asks for a token and keeps the corpus numbers on screen',
  async run(screen: ScreenContext) {
    // Nothing installed, so the page reads the shipped Worker — which in this lane has no
    // DASHBOARD_TOKEN, because a secret is not in the committed config. That is exactly
    // the deploy an operator meets first, and the half that needs no credential must
    // still be there behind the ask.
    screen.serveOperations(null);
    await screen.shoot(await screen.openDashboard('/'));
  },
} satisfies Case<ScreenContext>;
