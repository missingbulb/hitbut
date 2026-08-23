import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withSeries } from '../../shared/fixtures.ts';
import { detect } from '../../../../src/backend/detection/run.ts';

export default {
  title: 'a finding below the surfacing threshold is retained and excluded from the surfaced set',
  async run() {
    const corpus = emptyCorpus();
    // A step large enough to find, and no larger — so where the threshold sits decides
    // whether a reader ever sees it, and moving it must not cost a second analysis.
    const { figure, clusterId, versions } = await withSeries(corpus, [
      { position: 0.5, saidAt: '2024-01-10' },
      { position: 0.45, saidAt: '2024-05-02' },
      { position: -0.2, saidAt: '2025-03-14' },
      { position: -0.25, saidAt: '2025-11-08' },
    ]);

    const [found] = await detect({ corpus, versions, surfacingThreshold: 0.95 }, figure.id, clusterId);

    assert.ok(found, 'the detector found it');
    assert.equal(found.surfaced, false, 'and the threshold kept it out of the product');
    assert.ok(found.score > 0, 'while the score it scored is on the record');
    assert.ok(found.rationale.length > 0, 'and so is what it said');
    assert.deepEqual(found.restsOn.length, 2, 'and what it rests on');

    // Not shown, but not gone: the listing excludes it and a direct fetch still answers, so
    // lowering the threshold later is a query and never a re-analysis.
    assert.deepEqual(await corpus.findingsFor(figure.id), [found], 'the record is there to be re-read');
    assert.equal((await corpus.listFindings()).findings.length, 0, 'and the surfaced set is empty');

    assert.equal((await corpus.getFinding(found.id))?.score, found.score);
  },
} satisfies Case<void>;
