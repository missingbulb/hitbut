import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withSeries } from '../../shared/fixtures.ts';
import { detect } from '../../../../src/backend/detection/run.ts';

export default {
  title: 'a series that steps from one level to another yields a trend change with the interval it falls in',
  async run() {
    const corpus = emptyCorpus();

    // Held one position for three utterances, then held the opposite for three. The step is
    // between the third and the fourth, and that pair is all the series can bound it to.
    const { figure, clusterId, utterances, versions } = await withSeries(corpus, [
      { position: 0.8, saidAt: '2023-02-14' },
      { position: 0.75, saidAt: '2023-06-01' },
      { position: 0.85, saidAt: '2024-01-20' },
      { position: -0.7, saidAt: '2025-03-05' },
      { position: -0.65, saidAt: '2025-09-11' },
      { position: -0.75, saidAt: '2026-01-30' },
    ]);

    const found = await detect({ corpus, versions, surfacingThreshold: 0.5 }, figure.id, clusterId);
    const changes = found.filter((finding) => finding.kind === 'trend-change');

    assert.equal(changes.length, 1);
    const [change] = changes;

    // The interval, not a date. A series says the move happened between the last utterance
    // before it and the first after it, and claiming a day would be inventing precision.
    assert.deepEqual(change?.changed, { after: '2024-01-20', before: '2025-03-05' });
    assert.equal(change?.venue, null, 'a trend change is not about one room');
    assert.deepEqual(
      change?.restsOn.sort((a, b) => a.role.localeCompare(b.role)),
      [
        { utteranceId: utterances[3]!.id, role: 'after' },
        { utteranceId: utterances[2]!.id, role: 'before' },
      ],
      'and names the utterance either side, which is what the page shows',
    );
    assert.equal(change?.surfaced, true);

    // With either end of the step undated there is no interval — and the interval is the
    // whole of what a trend change claims, so there is nothing to record rather than
    // something to record vaguely.
    const undated = emptyCorpus();
    const blurred = await withSeries(undated, [
      { position: 0.8, saidAt: '2023-02-14' },
      { position: 0.75, saidAt: '2023-06-01' },
      { position: 0.85, saidAt: null },
      { position: -0.7, saidAt: null },
      { position: -0.65, saidAt: null },
      { position: -0.75, saidAt: null },
    ]);
    const nothing = await detect(
      { corpus: undated, versions: blurred.versions, surfacingThreshold: 0.5 },
      blurred.figure.id,
      blurred.clusterId,
    );
    assert.deepEqual(
      nothing.filter((finding) => finding.kind === 'trend-change'),
      [],
      'a step nobody can date is not a claim the corpus can make',
    );
  },
} satisfies Case<void>;
