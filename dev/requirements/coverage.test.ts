// The coverage gate: every leaf in requirements.md is claimed by exactly one case, of a
// kind that exists and is executed. Doc-first means this is red by default — a leaf added
// with no case fails the build until something proves it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readLeaves, readRequirements, readProvisional, compareIds, REQUIREMENTS_ROOT } from './spec.ts';
import { KINDS, kindDirsOnDisk, readKindDir, readCases, goldenPath } from './registry.ts';

const leaves = readLeaves();
const requirementIds = new Set(readRequirements().map((r) => r.id));
const provisional = readProvisional();
const provisionalIds = new Set(provisional.map((p) => p.id));
const cases = readCases();

test('the spec has leaves to prove', () => {
  assert.ok(leaves.length > 0, 'requirements.md parsed to zero leaves — the parser or the doc is broken');
});

test('every leaf is claimed by exactly one case', () => {
  const claimants = new Map<string, string[]>();
  for (const c of cases) claimants.set(c.id, [...(claimants.get(c.id) ?? []), `${c.kind}/cases/${c.file}`]);

  const unclaimed = leaves
    .filter((leaf) => !claimants.has(leaf.id) && !provisionalIds.has(leaf.id))
    .map((leaf) => `${leaf.id} (requirements.md:${leaf.line})`);
  assert.deepEqual(unclaimed, [], `leaves with no case — write the case, or list the leaf in provisional.json:\n  ${unclaimed.join('\n  ')}`);

  const doubled = [...claimants].filter(([, files]) => files.length > 1).map(([id, files]) => `${id}: ${files.join(', ')}`);
  assert.deepEqual(doubled, [], `leaves claimed more than once:\n  ${doubled.join('\n  ')}`);
});

test('every case claims a leaf that exists', () => {
  const dangling = cases
    .filter((c) => !leaves.some((leaf) => leaf.id === c.id))
    .map((c) => `${c.kind}/cases/${c.file} claims ${c.id}, which is ${requirementIds.has(c.id) ? 'not a leaf (it has finer-numbered children)' : 'not in requirements.md'}`);
  assert.deepEqual(dangling, [], dangling.join('\n  '));
});

test('a provisional leaf is a real leaf, and has no case', () => {
  const bogus = provisional
    .filter((p) => !leaves.some((leaf) => leaf.id === p.id))
    .map((p) => `${p.id} is listed as provisional but is not a leaf in requirements.md`);
  assert.deepEqual(bogus, [], bogus.join('\n  '));

  const proven = provisional
    .filter((p) => cases.some((c) => c.id === p.id))
    .map((p) => `${p.id} is proven by a case — take it off the provisional list`);
  assert.deepEqual(proven, [], proven.join('\n  '));
});

test('every case file is named <slug>.<leaf-id>.case.ts', () => {
  const strays = KINDS.flatMap((k) =>
    readKindDir(k.name).unrecognised.map((file) => `${k.name}/cases/${file}`),
  );
  assert.deepEqual(strays, [], `files in a cases folder that no runner will ever run:\n  ${strays.join('\n  ')}`);
});

test('the registry and the kind folders on disk agree', () => {
  const declared = KINDS.map((k) => k.name).sort();
  const onDisk = kindDirsOnDisk();
  assert.deepEqual(
    onDisk,
    declared,
    'a kind folder exists that the registry does not declare (nothing runs it), or a declared kind has no cases folder',
  );
  const laneless = declared.filter((name) => !existsSync(path.join(REQUIREMENTS_ROOT, name, 'run.test.ts')));
  assert.deepEqual(laneless, [], `declared kinds with no runner — their cases would never execute: ${laneless.join(', ')}`);
});

test('only a visual kind holds images, and every image is a case’s golden', () => {
  for (const k of KINDS) {
    const { cases: kindCases, goldens } = readKindDir(k.name);
    if (!k.visual) {
      assert.deepEqual(goldens, [], `${k.name} is a coded kind — a screenshot cannot observe what it asserts, so it may hold no images`);
      continue;
    }
    const expected = kindCases.map((c) => c.golden!).sort();
    assert.deepEqual(goldens.sort(), expected, `${k.name}: committed images and cases do not correspond one to one`);
    const missing = kindCases.filter((c) => !existsSync(goldenPath(c))).map((c) => c.golden!);
    assert.deepEqual(missing, [], `${k.name}: cases with no committed golden — run the refresh and review the images: ${missing.join(', ')}`);
  }
});

test('leaves are numbered in order and none repeats', () => {
  const ids = leaves.map((leaf) => leaf.id);
  const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(repeated, [], `duplicate requirement ids — ids are citations and must be unique: ${repeated.join(', ')}`);
  assert.deepEqual([...ids].sort(compareIds), ids, 'requirements.md lists leaves out of numeric order');
});
