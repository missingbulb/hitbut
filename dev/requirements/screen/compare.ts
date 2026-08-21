// Comparing a capture with the committed golden. The comparison is exact: a tolerance is
// a standing invitation for unreviewed drift, and if a platform renders unstably the fix
// is the determinism (fonts, clock, fakes), not the threshold.
//
// A mismatch writes expected, actual and a diff to a gitignored folder — never beside the
// goldens — so the first thing anyone looks at is the picture, not the byte count.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const FAILURES = fileURLToPath(new URL('../failures/', import.meta.url));

/** Set by the refresh entry point: goldens are rewritten and reviewed in the diff. */
export const refreshing = (): boolean => process.env.HITBUT_REFRESH_GOLDENS === '1';

export type CompareOutcome = 'matched' | 'written';

export function compareWithGolden(actual: Buffer, goldenPath: string, label: string): CompareOutcome {
  if (refreshing() || !existsSync(goldenPath)) {
    writeFileSync(goldenPath, actual);
    return 'written';
  }

  const expected = readFileSync(goldenPath);
  if (expected.equals(actual)) return 'matched';

  mkdirSync(FAILURES, { recursive: true });
  const write = (suffix: string, bytes: Buffer) => {
    const file = path.join(FAILURES, `${label}.${suffix}.png`);
    writeFileSync(file, bytes);
    return file;
  };
  const expectedFile = write('expected', expected);
  const actualFile = write('actual', actual);

  const before = PNG.sync.read(expected);
  const after = PNG.sync.read(actual);
  if (before.width !== after.width || before.height !== after.height) {
    throw new Error(
      `${label}: the page is a different size than the approved one — ` +
        `${before.width}×${before.height} approved, ${after.width}×${after.height} rendered.\n` +
        `  ${expectedFile}\n  ${actualFile}`,
    );
  }

  const diff = new PNG({ width: before.width, height: before.height });
  const changed = pixelmatch(before.data, after.data, diff.data, before.width, before.height, { threshold: 0 });
  const diffFile = write('diff', PNG.sync.write(diff));
  throw new Error(
    `${label}: ${changed} pixels differ from the approved rendering.\n` +
      `  expected: ${expectedFile}\n  actual:   ${actualFile}\n  diff:     ${diffFile}\n` +
      '  If the change is intended, run `npm run requirements:refresh` and review the new images in the diff.',
  );
}
