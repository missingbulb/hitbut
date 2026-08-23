import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withSeries } from '../../shared/fixtures.ts';
import { detect } from '../../../../src/backend/detection/run.ts';

/**
 * The half that keeps the other two honest. A detector that finds something in every series
 * finds nothing, so the cases that matter most are the ones that must come back empty.
 */
const QUIET = [
  {
    what: 'a persona who has held one position throughout',
    // Varying, because a real series never repeats a number exactly, and a detector tuned
    // to a flat line would fire on ordinary variation in how a position is worded.
    points: [{ position: 0.8 }, { position: 0.74 }, { position: 0.85 }, { position: 0.79 }, { position: 0.82 }, { position: 0.77 }],
  },
  {
    what: 'a series too short to have a shape',
    // Far apart, and still nothing: two positions are not a trend however different.
    points: [{ position: 0.9 }, { position: -0.9 }, { position: 0.85 }],
  },
  {
    what: 'a series that drifts without stepping',
    // The distinction a change point exists to make: moving gradually is not moving at a
    // moment, and reporting an interval for it would name two dates that mean nothing.
    points: [{ position: 0.6 }, { position: 0.45 }, { position: 0.3 }, { position: 0.15 }, { position: 0.0 }, { position: -0.15 }],
  },
];

export default {
  title: 'a series that holds one position, and one too short to have a shape, yield nothing',
  async run() {
    for (const { what, points } of QUIET) {
      const corpus = emptyCorpus();
      const series = await withSeries(corpus, points);
      const found = await detect(
        { corpus, versions: series.versions, surfacingThreshold: 0.5 },
        series.figure.id,
        series.clusterId,
      );
      assert.deepEqual(found.map((finding) => finding.kind), [], `${what} produced a finding`);
    }

    // And the corpus holds nothing either — silence is nothing recorded, not something
    // recorded and hidden.
    const corpus = emptyCorpus();
    const flat = await withSeries(corpus, QUIET[0]!.points);
    await detect({ corpus, versions: flat.versions, surfacingThreshold: 0.5 }, flat.figure.id, flat.clusterId);
    assert.deepEqual(await corpus.findingsFor(flat.figure.id), []);
  },
} satisfies Case<void>;
