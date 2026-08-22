// Reading a date out of a source, keeping how much of it the source actually established.
import type { DatePrecision, SaidAt } from '../../shared/types.ts';

const SHAPES: { pattern: RegExp; precision: DatePrecision }[] = [
  { pattern: /^\d{4}-\d{2}-\d{2}$/, precision: 'day' },
  { pattern: /^\d{4}-\d{2}$/, precision: 'month' },
  { pattern: /^\d{4}$/, precision: 'year' },
];

/**
 * `null` for anything the source does not establish. Never widens a partial date into a
 * whole one: "1998-03" stays a month, because storing it as 1998-03-01 invents a day that
 * a timeline will then sort by, and every reader downstream would believe it.
 */
export function readSourceDate(raw: string | null | undefined): SaidAt {
  if (!raw) return null;
  const trimmed = raw.trim();
  const shape = SHAPES.find(({ pattern }) => pattern.test(trimmed));
  return shape ? { value: trimmed, precision: shape.precision } : null;
}

/** The instant to sort by. A month sorts at its start — for ordering only, never stored. */
export function sortableInstant(saidAt: SaidAt): string | null {
  if (!saidAt) return null;
  if (saidAt.precision === 'day') return saidAt.value;
  return saidAt.precision === 'month' ? `${saidAt.value}-01` : `${saidAt.value}-01-01`;
}
