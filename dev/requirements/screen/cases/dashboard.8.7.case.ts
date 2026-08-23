import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';
import { operationsView } from '../../../../src/backend/api/operations.ts';
import { SourceRegistry } from '../../../../src/backend/acquisition/registry.ts';
import { emptyCorpus, fixtureSource, REFERENCE_NOW } from '../../shared/fixtures.ts';

/** A crawl worth looking at: one module working, one overdue, one nobody has wired up. */
async function crawl() {
  const corpus = emptyCorpus();
  const registry = new SourceRegistry();
  registry.register({ ...fixtureSource({ documents: [] }), id: 'plenary-protocols', publisher: 'ארכיון לדוגמה', refreshMinutes: 720 });
  registry.register({ ...fixtureSource({ documents: [] }), id: 'press-releases', publisher: 'סוכנות לדוגמה', refreshMinutes: 60 });
  registry.register({ ...fixtureSource({ documents: [] }), id: 'committee-transcripts', publisher: 'ועדה לדוגמה', refreshMinutes: 1440 });

  const hoursAgo = (hours: number) => new Date(Date.parse(REFERENCE_NOW) - hours * 3_600_000).toISOString();

  await corpus.recordRun({
    sourceModule: 'plenary-protocols',
    startedAt: hoursAgo(2), finishedAt: hoursAgo(2),
    fetched: 6, cached: 214, utterances: 41, unattributed: 5, failures: [],
  });
  await corpus.recordRun({
    sourceModule: 'press-releases',
    startedAt: hoursAgo(19), finishedAt: hoursAgo(19),
    fetched: 0, cached: 88, utterances: 0, unattributed: 0, failures: [],
  });
  return operationsView(corpus, registry, () => REFERENCE_NOW);
}

export default {
  title: 'the dashboard shows the corpus totals, both distributions and every source module',
  async run(screen: ScreenContext) {
    screen.serveOperations(await crawl());
    await screen.shoot(await screen.openDashboard('/'));
  },
} satisfies Case<ScreenContext>;
