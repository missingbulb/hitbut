// The gallery gate: requirements.md equals what the generator produces, byte for byte.
// Without it the document drifts from the goldens it claims to show, and the drift is
// invisible — a picture that is no longer the product's is still a picture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { markerProblems, readSpec, renderGallery } from './gallery.ts';

test('every visual leaf has a gallery block, and no block is a leftover', () => {
  const problems = markerProblems(readSpec());
  assert.deepEqual(problems, [], problems.join('\n  '));
});

test('the gallery in requirements.md is what the generator produces', () => {
  const current = readSpec();
  assert.equal(
    renderGallery(current),
    current,
    'requirements.md differs from the generated gallery — run `npm run requirements:refresh` rather than editing the image lines',
  );
});
