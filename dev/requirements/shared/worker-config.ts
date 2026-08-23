// Where the harness runs the Worker from: the committed wrangler.toml, unchanged.
//
// It used to be a derived copy, because the `[ai]` binding made wrangler open an
// authenticated remote proxy to Cloudflare and refuse to start without a token. Detection
// is pure code over a stance series now, so there is no model binding to strip — and no
// gap between the config the harness runs and the config that deploys.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function harnessConfigPath(): string {
  return path.join(fileURLToPath(new URL('../../../', import.meta.url)), 'wrangler.toml');
}
