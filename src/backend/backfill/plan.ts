// Turning "this archive, back to 1998" into the list of slices a Workflow runs.
//
// **The slice size is a bet nobody has checked.** Cloudflare publishes limits on a
// Workflow's steps, duration and payload size, and the session that designed this could not
// reach the documentation to read them (#34 phase 1). So the size is a named constant with
// its provenance on it rather than a number that looks measured — and `plannedSlices` takes
// it as an argument, so changing it once the limits are known is one call site and no
// rewrite.
//
// A year is chosen because it is the unit an archive is usually organised in, not because
// anything says a year fits.

/** Months per slice. UNVERIFIED against Cloudflare's published Workflow limits — see #34. */
export const SLICE_MONTHS = 12;

export type Window = { from: string; to: string };

const monthsBetween = (from: string, to: string): number => {
  const [fy, fm] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];
  return (ty - fy) * 12 + (tm - fm);
};

/** `YYYY-MM-DD` for the first day of the month `offset` months after `from`. */
function addMonths(from: string, offset: number): string {
  const [year, month] = from.split('-').map(Number) as [number, number];
  const total = (year * 12 + (month - 1)) + offset;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}-01`;
}

/** The last day of the month before `exclusive`. */
function dayBefore(exclusive: string): string {
  const [year, month] = exclusive.split('-').map(Number) as [number, number];
  const previous = new Date(Date.UTC(year, month - 1, 0));
  return previous.toISOString().slice(0, 10);
}

/**
 * The windows covering `[from, to]`, oldest first, each at most `months` long.
 *
 * Oldest first because a backfill that starts at the recent end and works back leaves the
 * corpus looking complete long before it is — a persona's page would show a thin recent
 * record with nothing saying the rest is still coming.
 */
export function plannedSlices(from: string, to: string, months = SLICE_MONTHS): Window[] {
  if (from > to) return [];
  const windows: Window[] = [];
  for (let offset = 0; ; offset += months) {
    const start = offset === 0 ? from : addMonths(from.slice(0, 7) + '-01', offset);
    if (start > to) break;
    const nextStart = addMonths(from.slice(0, 7) + '-01', offset + months);
    windows.push({ from: start, to: nextStart > to ? to : dayBefore(nextStart) });
    if (nextStart > to) break;
  }
  return windows;
}
