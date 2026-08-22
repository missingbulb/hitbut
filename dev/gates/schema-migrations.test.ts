// The migration gate: a migration that a running Worker cannot survive is rejected unless
// it is declared the contract step of an expand that already shipped (issue #37).
//
// What this cannot see, and does not pretend to: whether the three steps landed as three
// separate merges. It checks the files, so it can insist the contract is a *later* file
// than the expand it retires — that the deploy applying it is not the deploy that
// introduced the new shape — and no further.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readMigrations, readMigration, hazardsIn, MIGRATIONS_DIR } from './schema-migrations.ts';

const migrations = readMigrations();

test('there are migrations to check', () => {
  // A directory that moved would leave every assertion below vacuously green.
  assert.ok(migrations.length > 0, `no .sql files under ${MIGRATIONS_DIR} — the gate is checking nothing`);
});

test('a migration a running Worker cannot survive is declared a contract step', () => {
  const unmarked = migrations
    .filter((m) => m.hazards.length > 0 && !m.contractOf)
    .flatMap((m) => m.hazards.map((h) => `${m.name}:${h.line} ${h.kind} — ${h.why}\n    ${h.text}`));
  assert.deepEqual(
    unmarked,
    [],
    'the deploy applies migrations before it replaces the Worker, so these run against code that is still serving.\n'
      + '  Split the change: expand now, migrate readers, and drop the old shape in a later merge marked\n'
      + '  `-- contract-of: <name>` against an earlier `-- expand: <name>`.\n  '
      + unmarked.join('\n  '),
  );
});

test('a contract step retires an expand that an earlier migration declared', () => {
  const wrong: string[] = [];
  for (const [index, m] of migrations.entries()) {
    if (!m.contractOf) continue;
    const earlier = migrations.slice(0, index);
    if (earlier.some((e) => e.expands.includes(m.contractOf as string))) continue;
    const later = migrations.slice(index).some((e) => e.expands.includes(m.contractOf as string));
    wrong.push(
      `${m.name} contracts "${m.contractOf}", which ${later ? 'is expanded by a later migration — the contract cannot precede its own expand' : 'no migration declares with `-- expand: ' + m.contractOf + '`'}`,
    );
  }
  assert.deepEqual(wrong, [], wrong.join('\n  '));
});

test('a contract step has something to contract', () => {
  const idle = migrations
    .filter((m) => m.contractOf && m.hazards.length === 0)
    .map((m) => `${m.name} is marked \`contract-of: ${m.contractOf}\` but drops, renames and requires nothing — the marker is noise a later migration will copy`);
  assert.deepEqual(idle, [], idle.join('\n  '));
});

test('a migration does not both open and close the same expand', () => {
  const both = migrations
    .filter((m) => m.contractOf && m.expands.includes(m.contractOf))
    .map((m) => `${m.name} expands and contracts "${m.contractOf}" in one file — the point of the split is that a deploy sits between them`);
  assert.deepEqual(both, [], both.join('\n  '));
});

// The classifier, against text the repo does not contain: the assertions above are only
// worth their green if these are red for the right reasons.

test('a new table with required columns is not a hazard', () => {
  assert.deepEqual(hazardsIn('CREATE TABLE t (id TEXT NOT NULL, name TEXT NOT NULL);'), []);
});

test('a required column added to an existing table is', () => {
  const [hazard, ...rest] = hazardsIn('ALTER TABLE utterances ADD COLUMN stance TEXT NOT NULL;');
  assert.equal(rest.length, 0);
  assert.equal(hazard?.kind, 'required-column');
});

test('a nullable column added to an existing table is not', () => {
  assert.deepEqual(hazardsIn('ALTER TABLE utterances ADD COLUMN stance TEXT;'), []);
});

test('a drop and a rename are, and they carry their line', () => {
  const found = hazardsIn('CREATE TABLE a (id TEXT);\nDROP TABLE b;\nALTER TABLE c RENAME TO d;');
  assert.deepEqual(found.map((h) => [h.kind, h.line]), [['drop', 2], ['rename', 3]]);
});

test('a hazard written in a comment is not one', () => {
  assert.deepEqual(hazardsIn('-- Deliberately does not DROP statements yet.\n/* nor RENAME it */\nCREATE TABLE a (id TEXT);'), []);
});

test("a hazard written in a string literal is not one", () => {
  assert.deepEqual(hazardsIn("INSERT INTO fts(fts, rowid) VALUES('delete', 1);\nCREATE TABLE \"rename_log\" (id TEXT);"), []);
});

test('the step markers are read from the comments they live in', () => {
  const m = readMigration('0009_x.sql', '-- expand: stance\n-- contract-of: utterances\nDROP TABLE statements;');
  assert.deepEqual(m.expands, ['stance']);
  assert.equal(m.contractOf, 'utterances');
});

test('a marker only counts on a line of its own', () => {
  const m = readMigration('0009_x.sql', '-- see the contract-of: utterances marker in 0010\nCREATE TABLE a (id TEXT);');
  assert.equal(m.contractOf, null);
});
