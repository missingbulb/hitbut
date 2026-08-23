import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';
import { PHONE } from '../harness.ts';
import { operationsView } from '../../../../src/backend/api/operations.ts';
import { SourceRegistry } from '../../../../src/backend/acquisition/registry.ts';
import { emptyCorpus, fixtureSource, REFERENCE_NOW } from '../../shared/fixtures.ts';

/** The same crawl as 8.7, at the width somebody actually checks it from. */
async function crawl() {
  const corpus = emptyCorpus();
  const registry = new SourceRegistry();
  registry.register({ ...fixtureSource({ documents: [] }), id: 'plenary-protocols', publisher: 'ארכיון לדוגמה', refreshMinutes: 720 });
  registry.register({ ...fixtureSource({ documents: [] }), id: 'committee-transcripts', publisher: 'ועדה לדוגמה', refreshMinutes: 1440 });

  await corpus.recordRun({
    sourceModule: 'plenary-protocols',
    startedAt: new Date(Date.parse(REFERENCE_NOW) - 2 * 3_600_000).toISOString(),
    finishedAt: REFERENCE_NOW,
    fetched: 6, cached: 214, utterances: 41, unattributed: 5,
    failures: [{ key: 'protocol-2026-03-04', reason: 'bot_wall: the response was a challenge page' }],
  });
  return operationsView(corpus, registry, () => REFERENCE_NOW);
}

export default {
  title: 'the console is legible on a phone',
  async run(screen: ScreenContext) {
    screen.serveOperations(await crawl());
    await screen.shoot(await screen.openDashboard('/', PHONE));
  },
} satisfies Case<ScreenContext>;
