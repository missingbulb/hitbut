import type { Case } from '../../registry.ts';
import type { ScreenContext } from '../run.test.ts';
import { operationsView } from '../../../../src/backend/api/operations.ts';
import { SourceRegistry } from '../../../../src/backend/acquisition/registry.ts';
import { emptyCorpus, fixtureSource, REFERENCE_NOW } from '../../shared/fixtures.ts';

/**
 * Two modules failing for unrelated reasons, plus one that is fine. What the picture has
 * to show is which module each reason belongs to: a single list of failures at the bottom
 * of the page answers "is something wrong" and never "what do I go and fix".
 */
async function failing() {
  const corpus = emptyCorpus();
  const registry = new SourceRegistry();
  registry.register({ ...fixtureSource({ documents: [] }), id: 'plenary-protocols', publisher: 'ארכיון לדוגמה', refreshMinutes: 720 });
  registry.register({ ...fixtureSource({ documents: [] }), id: 'press-releases', publisher: 'סוכנות לדוגמה', refreshMinutes: 60 });

  await corpus.recordRun({
    sourceModule: 'plenary-protocols',
    startedAt: REFERENCE_NOW, finishedAt: REFERENCE_NOW,
    fetched: 3, cached: 210, utterances: 12, unattributed: 1,
    failures: [
      { key: 'protocol-2026-03-04', reason: 'bot_wall: the response was a challenge page, not a document' },
      { key: 'protocol-2026-03-05', reason: 'http_503: the archive answered 503 three times' },
    ],
  });
  await corpus.recordRun({
    sourceModule: 'press-releases',
    startedAt: REFERENCE_NOW, finishedAt: REFERENCE_NOW,
    fetched: 4, cached: 12, utterances: 9, unattributed: 0,
    failures: [{ key: '01JBQ7', reason: 'no embedding model is bound (#27)' }],
  });
  return operationsView(corpus, registry, () => REFERENCE_NOW);
}

export default {
  title: 'the dashboard dates its reading and files each failure against its own module',
  async run(screen: ScreenContext) {
    screen.serveOperations(await failing());
    await screen.shoot(await screen.openDashboard('/'));
  },
} satisfies Case<ScreenContext>;
