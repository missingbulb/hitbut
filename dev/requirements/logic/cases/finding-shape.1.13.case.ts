import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withFigure, withUtterance } from '../../shared/fixtures.ts';

const AT_COMMITTEE = 'הרכבת הקלה היא פרויקט לאומי ואנחנו מחויבים לו.';
const AT_A_RALLY = 'לא אצביע בעד תקציב שגורע ולו שקל אחד מהרכבת הקלה.';

/** What the store must refuse, and what makes each one incomplete. */
const REFUSED = [
  { what: 'an anomaly with no venue', point: 'who they were talking to' },
  { what: 'a trend change with no interval', point: 'when the position moved' },
];

export default {
  title: 'a finding names the utterances it rests on and carries the attribute its kind turns on',
  async run() {
    const corpus = emptyCorpus();
    const figure = await withFigure(corpus, 'דמות לדוגמה');
    const committee = await withUtterance(corpus, figure.id, AT_COMMITTEE, {
      key: 'committee', venue: 'committee', audience: 'parliament',
      saidAt: { value: '2024-02-01', precision: 'day' },
    });
    const rally = await withUtterance(corpus, figure.id, AT_A_RALLY, {
      key: 'rally', venue: 'rally', audience: 'party-members',
      saidAt: { value: '2024-02-08', precision: 'day' },
    });
    const { clusterId } = await corpus.assignToCluster(committee.id, null, 0);
    await corpus.assignToCluster(rally.id, clusterId, 0.06);

    // An anomaly's point is the audience it was addressed to, so it carries the venue and
    // the audience of the utterance that deviated.
    const anomaly = await corpus.recordFinding({
      figureId: figure.id, clusterId, kind: 'anomaly',
      rationale: 'המיקום בעצרת רחוק מהמיקום שהוצג בוועדה שבוע קודם.', score: 0.77,
      venue: 'rally', audience: 'party-members',
      restsOn: [{ utteranceId: rally.id, role: 'deviating' }],
      modelVersion: 'sample/stance-0', promptVersion: 'find-v1',
    }, 0.5);

    assert.equal(anomaly.venue, 'rally');
    assert.equal(anomaly.audience, 'party-members');
    assert.equal(anomaly.changed, null, 'an anomaly makes no claim about when anything moved');
    assert.deepEqual(anomaly.restsOn, [{ utteranceId: rally.id, role: 'deviating' }]);

    // A trend change's point is when, and the honest answer is the interval the series
    // bounds it to — never a date, which the series cannot support.
    const trend = await corpus.recordFinding({
      figureId: figure.id, clusterId, kind: 'trend-change',
      rationale: 'המיקום עבר בין שתי ההתבטאויות.', score: 0.7,
      changed: { after: '2024-02-01', before: '2024-02-08' },
      restsOn: [
        { utteranceId: committee.id, role: 'before' },
        { utteranceId: rally.id, role: 'after' },
      ],
      modelVersion: 'sample/stance-0', promptVersion: 'find-v1',
    }, 0.5);

    assert.deepEqual(trend.changed, { after: '2024-02-01', before: '2024-02-08' });
    assert.equal(trend.venue, null, 'a trend change is not about one room');
    assert.deepEqual(
      trend.restsOn.map((rests) => rests.role).sort(),
      ['after', 'before'],
      'and it names the utterance either side of the change',
    );

    // Neither kind can be stored missing its own point. A record that can be would read as
    // complete and would not be.
    const attempts = [
      () => corpus.recordFinding({
        figureId: figure.id, clusterId, kind: 'anomaly',
        rationale: 'ללא מקום.', score: 0.9,
        restsOn: [{ utteranceId: rally.id, role: 'deviating' }],
        modelVersion: 'sample/stance-0', promptVersion: 'find-v1',
      }, 0.5),
      () => corpus.recordFinding({
        figureId: figure.id, clusterId, kind: 'trend-change',
        rationale: 'ללא טווח.', score: 0.9,
        restsOn: [{ utteranceId: rally.id, role: 'after' }],
        modelVersion: 'sample/stance-0', promptVersion: 'find-v1',
      }, 0.5),
    ];

    // Thunks, not promises: a rejection created before it is awaited is an unhandled one.
    for (const [index, attempt] of attempts.entries()) {
      await assert.rejects(attempt, `${REFUSED[index]?.what} is stored without ${REFUSED[index]?.point}`);
    }

    // And the refusals left nothing behind: the two findings above are still the only ones.
    assert.equal((await corpus.findingsFor(figure.id)).length, 2);
  },
} satisfies Case<void>;
