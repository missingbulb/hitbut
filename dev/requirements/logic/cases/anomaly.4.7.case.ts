import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withSeries } from '../../shared/fixtures.ts';
import { detect } from '../../../../src/backend/detection/run.ts';

export default {
  title: 'a stance that deviates from the prevailing position is found, carrying where it was said',
  async run() {
    const corpus = emptyCorpus();

    // A persona who holds one position in every room but one. The rally is the outlier, and
    // *that it was the rally* is the whole of what makes the finding worth surfacing.
    const { figure, clusterId, utterances, versions } = await withSeries(corpus, [
      { position: 0.8, venue: 'committee', audience: 'parliament' },
      { position: 0.75, venue: 'interview', audience: 'general-public' },
      { position: -0.4, venue: 'rally', audience: 'party-members' },
      { position: 0.85, venue: 'plenary', audience: 'parliament' },
      { position: 0.8, venue: 'committee', audience: 'parliament' },
    ]);

    const found = await detect({ corpus, versions, surfacingThreshold: 0.5 }, figure.id, clusterId);
    const anomalies = found.filter((finding) => finding.kind === 'anomaly');

    assert.equal(anomalies.length, 1, 'exactly the one utterance that sits apart');
    const [anomaly] = anomalies;
    assert.deepEqual(anomaly?.restsOn, [{ utteranceId: utterances[2]!.id, role: 'deviating' }]);

    // The interesting attribute, carried from the utterance because that is where the
    // speech act's own properties live.
    assert.equal(anomaly?.venue, 'rally');
    assert.equal(anomaly?.audience, 'party-members');
    assert.equal(anomaly?.changed, null, 'an anomaly makes no claim about when anything moved');
    assert.equal(anomaly?.surfaced, true);
    assert.equal(anomaly?.modelVersion, versions.modelVersion, 'and names the model that placed it');

    // A candidate with company is not an anomaly. A series that has split into two levels is
    // what a *trend change* looks like, and reporting each of its points as an utterance out
    // of step would be the same series claimed twice, in two incompatible ways.
    const split = emptyCorpus();
    const twoLevels = await withSeries(split, [
      { position: 0.8 }, { position: 0.8 }, { position: -0.5 }, { position: -0.5 }, { position: -0.5 },
    ]);
    const onTheSplit = await detect(
      { corpus: split, versions: twoLevels.versions, surfacingThreshold: 0.5 },
      twoLevels.figure.id,
      twoLevels.clusterId,
    );
    assert.deepEqual(
      onTheSplit.filter((finding) => finding.kind === 'anomaly'),
      [],
      'a second position the persona holds is not an utterance out of step',
    );
    assert.equal(
      onTheSplit.filter((finding) => finding.kind === 'trend-change').length,
      1,
      'it is a trend change, and only that',
    );
  },
} satisfies Case<void>;
