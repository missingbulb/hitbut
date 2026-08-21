// The committed wrangler.toml is what the harness runs the Worker from, with exactly one
// deliberate subtraction.
//
// Workers AI has no local emulation: the moment the `[ai]` binding appears in the
// environment being run, wrangler opens an authenticated remote proxy to Cloudflare and
// refuses to start without an API token. Nothing the server or screen lane asserts goes
// near the judge, so the harness runs the same config with that one binding removed —
// derived from the committed file at run time, never a second copy to keep in step. The
// consequence, that no lane exercises the real model, is one of the honest gaps in #28.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const COMMITTED = path.join(REPO_ROOT, 'wrangler.toml');
// Beside the committed file, because `main` and `migrations_dir` in it are relative to
// wherever the config sits. Gitignored: it is generated on every run.
const DERIVED = path.join(REPO_ROOT, '.wrangler-harness.toml');

/** Drops one top-level table from a TOML document, header and body. */
function withoutTable(toml: string, table: string): { toml: string; removed: number } {
  const lines = toml.split('\n');
  const kept: string[] = [];
  let removed = 0;
  let dropping = false;
  for (const line of lines) {
    if (/^\s*\[/.test(line)) dropping = line.trim() === `[${table}]`;
    if (dropping) removed += 1;
    else kept.push(line);
  }
  return { toml: kept.join('\n'), removed };
}

export function harnessConfigPath(): string {
  const { toml, removed } = withoutTable(readFileSync(COMMITTED, 'utf8'), 'ai');
  if (removed === 0) {
    throw new Error(
      'wrangler.toml no longer has an [ai] table: the harness strips one, so either the binding moved ' +
        '(update this file) or the subtraction is no longer needed (delete it).',
    );
  }
  writeFileSync(DERIVED, `# Generated from wrangler.toml by dev/requirements/shared/worker-config.ts.\n${toml}`);
  return DERIVED;
}
