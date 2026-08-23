import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { operationsView } from '../../../../src/backend/api/operations.ts';
import { SourceRegistry } from '../../../../src/backend/acquisition/registry.ts';
import { emptyCorpus, fixtureSource, REFERENCE_NOW } from '../../shared/fixtures.ts';

export default {
  title: 'operations reports what each module fetched, cached and failed on',
  async run() {
    const corpus = emptyCorpus();
    const registry = new SourceRegistry();
    registry.register(fixtureSource({ documents: [] }));
    const [module] = registry.all();

    await corpus.recordRun({
      sourceModule: module.id,
      startedAt: REFERENCE_NOW,
      finishedAt: REFERENCE_NOW,
      fetched: 4,
      cached: 11,
      utterances: 9,
      unattributed: 2,
      failures: [
        { key: 'protocol-2026-03-04', reason: 'bot_wall: the response was a challenge page' },
        { key: '01JB', reason: 'no embedding model is bound' },
      ],
    });

    const view = await operationsView(corpus, registry, () => REFERENCE_NOW);
    assert.equal(view.modules.length, 1);
    const [state] = view.modules;
    assert.equal(state.id, module.id);
    assert.equal(state.publisher, module.publisher);
    assert.ok(state.lastRun, 'a module that has run must carry its run');

    assert.equal(state.lastRun.fetched, 4);
    assert.equal(state.lastRun.cached, 11);
    assert.equal(state.lastRun.utterances, 9);
    // Both kinds of failure survive the round trip, and each keeps the key it was about —
    // "something failed" is not a report anybody can act on.
    assert.deepEqual(
      state.lastRun.failures.map((failure) => failure.key),
      ['protocol-2026-03-04', '01JB'],
    );
    assert.match(state.lastRun.failures[0].reason, /bot_wall/);
    assert.match(state.lastRun.failures[1].reason, /embedding model/);
  },
} satisfies Case<void>;
