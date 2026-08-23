// The dashboard's marks, drawn in CSS rather than SVG and without a charting library:
// three small forms do not justify a dependency, and nothing here loads from a CDN.
//
// Form follows the data's job. Headline counts are stat tiles, not a one-bar chart. Venue
// is magnitude across long-named classes, so horizontal bars. Year is magnitude over time,
// so columns. Length carries the magnitude in both, which leaves colour one job and one
// hue — and CSS lengths reflow with the container, where a fixed viewBox letterboxes.
import type { JSX } from 'preact';
import type { Distribution } from '../../shared/types.ts';

/** A count, formatted for a reader rather than for a machine. */
export const count = (value: number): string => value.toLocaleString('en-GB');

/**
 * Never zero-length: a bucket with one item in it must still be visible as a mark. `ceiling`
 * leaves room above a column for the number that labels it.
 */
const share = (value: number, most: number, ceiling = 100): string =>
  `${Math.max(2, (value / most) * ceiling)}%`;

export function StatTile({ label, value, note }: { label: string; value: number; note?: string }): JSX.Element {
  return (
    <div class="tile">
      <div class="tile__value">{count(value)}</div>
      <div class="tile__label">{label}</div>
      {note ? <div class="tile__note">{note}</div> : null}
    </div>
  );
}

/**
 * Horizontal bars, because a venue's name is a phrase and a rotated axis label is a
 * readability tax nobody has to pay. Sorted by magnitude, which is the comparison.
 */
export function VenueBars({ distribution }: { distribution: Distribution }): JSX.Element {
  const most = Math.max(1, ...distribution.buckets.map((bucket) => bucket.count));
  return (
    <ul class="bars">
      {distribution.buckets.map((bucket) => (
        <li class="bars__row" key={bucket.name}>
          <span class="bars__name">{bucket.name}</span>
          <span class="bars__track">
            <span class="bars__fill" style={{ width: share(bucket.count, most) }} />
          </span>
          <span class="bars__value">{count(bucket.count)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Columns over time. The undated are deliberately NOT a column here: they have no year to
 * stand at, and giving them one would put back the guess `1.3` refused to make. They are
 * reported beside the axis instead, as their own figure.
 */
export function YearColumns({ distribution }: { distribution: Distribution }): JSX.Element {
  const most = Math.max(1, ...distribution.buckets.map((bucket) => bucket.count));
  return (
    <div class="years">
      <ul class="columns">
        {distribution.buckets.map((bucket) => (
          <li class="columns__item" key={bucket.name}>
            <span class="columns__value">{count(bucket.count)}</span>
            <span class="columns__fill" style={{ height: share(bucket.count, most, 84) }} />
          </li>
        ))}
      </ul>
      {/* The year labels ride below the axis in their own row, laid out on the same flex
          rule as the columns, so a label sits under its own column at any width. */}
      <ul class="years__names">
        {distribution.buckets.map((bucket) => (
          <li key={bucket.name}>{bucket.name}</li>
        ))}
      </ul>
      <p class="years__undated">
        <strong>{count(distribution.undated)}</strong> undated — no source established when these were said,
        so they stand outside the axis rather than inside a year nobody claimed.
      </p>
    </div>
  );
}
