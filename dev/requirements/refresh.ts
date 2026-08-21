// One entry point that regenerates the goldens and the gallery together, so the two
// cannot skew: the images are re-rendered from the shipped code, then requirements.md is
// rewritten to embed exactly what is on disk.
//
// This is how an *intended* UI change lands — the refreshed images ride the diff for the
// owner to approve. It is never how a red case gets fixed: a mismatch is surfaced with
// expected, actual and diff, and re-baselining is the owner's call on the evidence.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SPEC_PATH } from './spec.ts';
import { readSpec, renderGallery } from './gallery.ts';

const runner = fileURLToPath(new URL('./screen/run.test.ts', import.meta.url));
const rendered = spawnSync(process.execPath, ['--test', '--test-timeout=600000', runner], {
  stdio: 'inherit',
  env: { ...process.env, HITBUT_REFRESH_GOLDENS: '1' },
});
if (rendered.status !== 0) {
  console.error('the screen lane did not finish; the gallery was left alone');
  process.exit(rendered.status ?? 1);
}

writeFileSync(SPEC_PATH, renderGallery(readSpec()));
console.log('goldens re-rendered and the gallery rewritten — review every changed image in the diff');
