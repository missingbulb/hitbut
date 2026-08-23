// One persona, one subject: read the stance series and record what it says.
//
// Everything defensible about a finding comes from here being boring — the maths is in
// `series.ts` and takes no store, this takes no model, and what a reader ends up seeing is
// which utterances a finding rests on plus the model and prompt that placed them.
import type { Corpus } from '../corpus/store.ts';
import type { Finding } from '../../shared/types.ts';
import { anomaliesIn, trendChangeIn, DEFAULTS, type Point, type Thresholds } from './series.ts';

export type DetectOptions = {
  corpus: Corpus;
  /** Which placements to read: a series must never mix two models or two prompts. */
  versions: { modelVersion: string; promptVersion: string };
  surfacingThreshold: number;
  thresholds?: Thresholds;
};

/**
 * Confidence in a finding, from how far the thing that triggered it exceeded its bar.
 *
 * A deliberately blunt mapping rather than a calibrated probability: it exists so the
 * surfacing threshold has something to compare against, and calling it a probability would
 * be dressing a rule of thumb up as a measurement.
 */
const scoreFor = (observed: number, bar: number): number => Math.min(1, observed / (bar * 2));

export async function detect(options: DetectOptions, figureId: string, clusterId: string): Promise<Finding[]> {
  const thresholds = options.thresholds ?? DEFAULTS;
  const series = await options.corpus.stanceSeries(figureId, clusterId, options.versions);
  const points: Point[] = series.map(({ utterance, stance }) => ({
    utteranceId: utterance.id,
    position: stance.position,
    saidAt: utterance.saidAt?.value ?? null,
  }));

  const recorded: Finding[] = [];
  const utteranceById = new Map(series.map(({ utterance }) => [utterance.id, utterance]));

  for (const anomaly of anomaliesIn(points, thresholds)) {
    const utterance = utteranceById.get(anomaly.utteranceId);
    if (!utterance) continue;
    recorded.push(await options.corpus.recordFinding({
      figureId,
      clusterId,
      kind: 'anomaly',
      rationale: `ההתבטאות הזו רחוקה ב־${anomaly.distance.toFixed(2)} מהעמדה שהדמות מחזיקה בנושא הזה בדרך כלל.`,
      score: scoreFor(anomaly.distance, thresholds.anomalyDistance),
      // The point of the finding: not that a position moved but that it moved *here*.
      venue: utterance.venue,
      audience: utterance.audience,
      restsOn: [{ utteranceId: utterance.id, role: 'deviating' }],
      ...options.versions,
    }, options.surfacingThreshold));
  }

  const change = trendChangeIn(points, thresholds);
  // Without both ends dated there is no interval, and an interval is the whole of what a
  // trend change claims — so there is nothing to record rather than something to record
  // vaguely.
  if (change?.changed) {
    const size = Math.abs(change.toLevel - change.fromLevel);
    recorded.push(await options.corpus.recordFinding({
      figureId,
      clusterId,
      kind: 'trend-change',
      rationale: `העמדה בנושא עברה מ־${change.fromLevel.toFixed(2)} ל־${change.toLevel.toFixed(2)} בין שתי ההתבטאויות האלה.`,
      score: scoreFor(size, thresholds.stepSize),
      changed: change.changed,
      restsOn: [
        { utteranceId: change.before.utteranceId, role: 'before' },
        { utteranceId: change.after.utteranceId, role: 'after' },
      ],
      ...options.versions,
    }, options.surfacingThreshold));
  }

  return recorded;
}
