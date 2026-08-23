import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { backfillWorld } from '../../shared/backfill-harness.ts';
import { payloadOf } from '../../shared/acquisition-harness.ts';
import { runSlice } from '../../../../src/backend/backfill/slice.ts';
import { plannedSlices } from '../../../../src/backend/backfill/plan.ts';

const say = (text: string) => payloadOf([['דמות לדוגמה', '', 'תקציב', text]]);

export default {
  title: 'a backfill slice runs end to end, and a slice that fails leaves its neighbours alone',
  async run() {
    // Three years of an archive, one document each, and the middle year's document is a
    // dead URL. A slice is a window of dates, and each document's key carries its own.
    const world = await backfillWorld([
      { key: '2023-04-11', url: 'https://example.org/a/2023-04-11', payload: say('אמירה משנת 2023.') },
      { key: '2024-07-02', url: 'https://example.org/a/2024-07-02', payload: '', response: { status: 404, body: 'gone' } },
      { key: '2025-02-19', url: 'https://example.org/a/2025-02-19', payload: say('אמירה משנת 2025.') },
    ]);

    const slices = plannedSlices('2023-01-01', '2025-12-31');
    assert.equal(slices.length, 3, 'three years, three windows');
    assert.deepEqual(slices[0], { from: '2023-01-01', to: '2023-12-31' }, 'oldest first — a backfill that starts recent looks complete before it is');

    const outcomes = [];
    for (const slice of slices) {
      outcomes.push(await runSlice(world.deps, world.module, { sourceModule: world.module.id, ...slice }));
    }

    // Each slice saw only its own window. That is what makes them independent, and what
    // makes one bad slice cost one retry rather than a restart.
    assert.deepEqual(outcomes.map((outcome) => outcome.fetched), [1, 0, 1]);
    assert.deepEqual(outcomes.map((outcome) => outcome.utterances), [1, 0, 1]);

    // The failing slice reports rather than throws, and names what it could not get.
    assert.deepEqual(outcomes[1]?.failures, [{ key: '2024-07-02', reason: 'http' }]);
    assert.deepEqual(outcomes[0]?.failures, [], 'the slice before it is untouched');
    assert.deepEqual(outcomes[2]?.failures, [], 'and so is the slice after');

    // The corpus holds exactly the two that landed — a failed neighbour did not roll them
    // back, and did not stop the third from running.
    const figure = (await world.corpus.resolveSpeaker(world.deps.roster, 'דמות לדוגמה'))!;
    assert.equal((await world.corpus.utterancesFor(figure.id)).length, 2);

    // A document whose key carries no date belongs to no window: guessing would put it in
    // one nobody established it was in, and windows are the whole shape of a backfill.
    const undatedWorld = await backfillWorld([
      { key: 'archive-index', url: 'https://example.org/a/index', payload: say('אמירה בלי תאריך במפתח.') },
    ]);
    const nothing = await runSlice(undatedWorld.deps, undatedWorld.module, {
      sourceModule: undatedWorld.module.id, from: '1990-01-01', to: '2030-12-31',
    });
    assert.equal(nothing.fetched, 0, 'not fetched by a window that spans forty years');
  },
} satisfies Case<void>;
