// Reading a stance series for the two things it can honestly say: that one utterance sits
// apart from the persona's usual position on a subject, and that the position moved.
//
// Pure functions over a series, with no store and no model in sight — which is what lets
// a case plant a step change or an outlier and assert exactly what comes back. The
// thresholds are the whole of the policy, so they are named, defaulted in one place, and
// overridable per call.

/** One point: where the persona stood, and when. */
export type Point = {
  utteranceId: string;
  /** -1..1 on the subject's axis. */
  position: number;
  /**
   * When it was said. Null means the source established no date — such a point is kept in
   * the series (it is still something the persona said) but cannot bound an interval.
   */
  saidAt: string | null;
};

export type Thresholds = {
  /**
   * How far from the prevailing position an utterance must sit to be an anomaly, in
   * absolute axis units. The axis runs -1..1, so this is a quarter of its full width:
   * enough to exclude ordinary variation in how a position is worded on a given day.
   */
  anomalyDistance: number;
  /**
   * How far the level must move across a candidate change point to be a trend change.
   * Higher than `anomalyDistance` on purpose — a trend is a claim about a persona's whole
   * position, and a weaker bar would report every noisy stretch as a change of mind.
   */
  stepSize: number;
  /**
   * The fewest points either side of a change point. Two points cannot establish a level,
   * so a "change" between two singletons is one utterance either side of a gap.
   */
  minimumRun: number;
};

export const DEFAULTS: Thresholds = { anomalyDistance: 0.5, stepSize: 0.6, minimumRun: 2 };

/** Ordered oldest first, undated points last — a series is a claim about time. */
export function inTimeOrder(points: Point[]): Point[] {
  return [...points].sort((a, b) => {
    if (a.saidAt && b.saidAt) return a.saidAt.localeCompare(b.saidAt) || a.utteranceId.localeCompare(b.utteranceId);
    if (a.saidAt) return -1;
    if (b.saidAt) return 1;
    return a.utteranceId.localeCompare(b.utteranceId);
  });
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[middle] as number) : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
};

export type Anomaly = { utteranceId: string; position: number; prevailing: number; distance: number };

/**
 * How many other utterances may share a candidate's neighbourhood before it stops being an
 * anomaly and becomes a second position the persona also holds. A fraction of the series
 * rather than a count, so it means the same thing on a series of six and one of six hundred.
 */
const COMPANY = 0.15;

/**
 * Utterances sitting far from where the persona otherwise stands on this subject — one out
 * of step, not a position they hold as well.
 *
 * Two rules, and the second is the one that is easy to miss. The prevailing position is the
 * median of *everything else*, recomputed per candidate, because a baseline including the
 * candidate is pulled towards it and lets a far-enough outlier hide behind it. And a
 * candidate with company is not an outlier: a series that has genuinely split into two
 * levels is what a **trend change** looks like, and without this every point in one would
 * be reported as an anomaly as well.
 */
export function anomaliesIn(points: Point[], thresholds: Thresholds = DEFAULTS): Anomaly[] {
  // Below four, "the others" is one or two points — a baseline too thin to call anything
  // a deviation from.
  if (points.length < 4) return [];

  const alone = Math.floor((points.length - 1) * COMPANY);
  const found: Anomaly[] = [];
  for (const [index, point] of points.entries()) {
    const others = points.filter((_, other) => other !== index);
    const prevailing = median(others.map((other) => other.position));
    const distance = Math.abs(point.position - prevailing);
    if (distance < thresholds.anomalyDistance) continue;

    const company = others.filter(
      (other) => Math.abs(other.position - point.position) < thresholds.anomalyDistance,
    ).length;
    if (company > alone) continue;

    found.push({ utteranceId: point.utteranceId, position: point.position, prevailing, distance });
  }
  return found;
}

export type TrendChange = {
  /** The last utterance before the change, and the first after it. */
  before: Point;
  after: Point;
  /** The levels either side, as the median of each run. */
  fromLevel: number;
  toLevel: number;
  /** The interval the change falls in. Null when either side of it is undated. */
  changed: { after: string; before: string } | null;
};

/**
 * The single largest step in the series, when it is large enough to be one.
 *
 * One change point, not several: a series with two genuine steps is a persona who moved
 * twice, and reporting the larger one now leaves the other to be found once the first is
 * accounted for. Reporting both from one pass would need a segmentation this does not do,
 * and claiming it would be a claim the method cannot support.
 */
export function trendChangeIn(points: Point[], thresholds: Thresholds = DEFAULTS): TrendChange | null {
  const ordered = inTimeOrder(points);
  if (ordered.length < thresholds.minimumRun * 2) return null;

  let best: (TrendChange & { size: number }) | null = null;
  for (let split = thresholds.minimumRun; split <= ordered.length - thresholds.minimumRun; split++) {
    const fromLevel = median(ordered.slice(0, split).map((point) => point.position));
    const toLevel = median(ordered.slice(split).map((point) => point.position));
    const size = Math.abs(toLevel - fromLevel);
    if (size < thresholds.stepSize || (best && size <= best.size)) continue;

    const before = ordered[split - 1] as Point;
    const after = ordered[split] as Point;
    best = {
      before,
      after,
      fromLevel,
      toLevel,
      size,
      // An interval needs both ends dated. Without them the series still shows the step —
      // it just cannot say when, and inventing a bound would be the fabrication the whole
      // date-precision rule exists to prevent.
      changed: before.saidAt && after.saidAt ? { after: before.saidAt, before: after.saidAt } : null,
    };
  }

  if (!best) return null;
  const { size: _size, ...change } = best;
  return change;
}
