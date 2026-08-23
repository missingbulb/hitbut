import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { operationsView } from '../../../../src/backend/api/operations.ts';
import { SourceRegistry } from '../../../../src/backend/acquisition/registry.ts';
import { emptyCorpus, fixtureSource, REFERENCE_NOW } from '../../shared/fixtures.ts';

// The distinction the dashboard exists for. A module whose parser broke on the first
// document and a module nobody ever wired up both show zero utterances, and only one of
// them is a problem — so never-run must not be spelled as a run that found nothing.
export default {
  title: 'a module that has never run is never reported as having run and found nothing',
  async run() {
    const corpus = emptyCorpus();
    const registry = new SourceRegistry();
    registry.register(fixtureSource({ documents: [], id: 'has-run' }));
    registry.register(fixtureSource({ documents: [], id: 'never-run' }));

    await corpus.recordRun({
      sourceModule: 'has-run',
      startedAt: REFERENCE_NOW,
      finishedAt: REFERENCE_NOW,
      // A real zero: it ran, and there was nothing new. This is the row the other module
      // must not be made to look like.
      fetched: 0,
      cached: 0,
      utterances: 0,
      unattributed: 0,
      failures: [],
    });

    const view = await operationsView(corpus, registry, () => REFERENCE_NOW);
    const byId = new Map(view.modules.map((module) => [module.id, module]));

    // Both modules are listed: the view is driven by the registry, so a module with no
    // rows is visible rather than absent — absent would be indistinguishable from healthy.
    assert.deepEqual([...byId.keys()].sort(), ['has-run', 'never-run']);

    assert.equal(byId.get('never-run')?.lastRun, null, 'never-run must be null, not a zeroed run');
    const ran = byId.get('has-run')?.lastRun;
    assert.ok(ran, 'the module that ran must carry its run');
    assert.equal(ran.utterances, 0, 'and its zero must stay a zero');
  },
} satisfies Case<void>;
