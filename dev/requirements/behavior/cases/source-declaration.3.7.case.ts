import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { SourceRegistry, type SourceModule } from '../../../../src/backend/acquisition/registry.ts';

const complete: SourceModule = {
  id: 'sample-protocols',
  publisher: 'ארכיון פרוטוקולים לדוגמה',
  kind: 'transcript',
  surface: 'hydration',
  refreshMinutes: 180,
  venue: 'plenary',
  list: async () => [],
  extract: () => [],
};

export default {
  title: 'the registry refuses a source that has not declared what the pipeline needs to run it',
  async run() {
    const registry = new SourceRegistry();
    registry.register(complete);
    assert.deepEqual(registry.all().map((module) => module.id), ['sample-protocols']);

    // The surface records which reconnaissance answer the parser rests on; there is no
    // support channel for these sites, so an undeclared one is a fact nobody can recover.
    assert.throws(
      () => registry.register({ ...complete, id: 'no-surface', surface: 'guesswork' as SourceModule['surface'] }),
      /data surface/,
    );
    // The clock records how fast the source actually moves. Without it everything runs on
    // the fastest clock, which is the traffic most likely to get us blocked.
    assert.throws(() => registry.register({ ...complete, id: 'no-clock', refreshMinutes: 0 }), /refresh interval/);
    // The room it reports from cannot be guessed from `kind`, which says how the document
    // was published rather than where the speaking happened — and the same words at two
    // venues are two utterances, which is the whole point of an anomaly.
    assert.throws(
      () => registry.register({ ...complete, id: 'no-venue', venue: 'the knesset' as SourceModule['venue'] }),
      /venue it reports from/,
    );
    assert.throws(() => registry.register({ ...complete, id: 'no-publisher', publisher: '' }), /publisher/);
    assert.throws(() => registry.register(complete), /already registered/);

    assert.deepEqual(registry.all().map((module) => module.id), ['sample-protocols'], 'nothing half-registered survived');
  },
} satisfies Case<void>;
