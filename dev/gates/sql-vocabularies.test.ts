// The migrations spell three vocabularies that TypeScript also spells — venue, audience,
// date precision — in CHECK constraints. SQL cannot import a TypeScript array, so this is
// the copy that has to be watched: adding a venue to the union and forgetting the schema
// gives a runtime that accepts the value everywhere except the one place it is stored, and
// the failure lands on whoever writes the first utterance from that venue.
//
// It reads the real migrations rather than a fixture, so a fixture cannot agree with a
// mistake the schema is actually making.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readMigrations } from './schema-migrations.ts';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MIGRATIONS_DIR } from './schema-migrations.ts';
import { AUDIENCES, DATE_PRECISIONS, VENUES } from '../../src/shared/types.ts';

const schema = readMigrations()
  .map((migration) => readFileSync(path.join(MIGRATIONS_DIR, migration.name), 'utf8'))
  .join('\n');

/** The values inside `<column> ... CHECK (<column> IN ('a', 'b'))`, wherever it is written. */
function checkedValues(column: string): string[][] {
  const found: string[][] = [];
  const pattern = new RegExp(`\\b${column}\\b[^;]*?CHECK\\s*\\(\\s*${column}\\s+IN\\s*\\(([^)]*)\\)`, 'gis');
  for (const match of schema.matchAll(pattern)) {
    found.push([...(match[1] ?? '').matchAll(/'([^']*)'/g)].map((value) => value[1] as string));
  }
  return found;
}

const VOCABULARIES: { column: string; expected: readonly string[] }[] = [
  { column: 'venue', expected: VENUES },
  { column: 'audience', expected: AUDIENCES },
  { column: 'said_at_precision', expected: DATE_PRECISIONS },
];

for (const { column, expected } of VOCABULARIES) {
  test(`every CHECK on ${column} lists exactly the values src/shared/types.ts does`, () => {
    const found = checkedValues(column);
    assert.ok(found.length > 0, `no CHECK (${column} IN (…)) found in the migrations — did the column move, or the constraint go?`);
    for (const values of found) {
      assert.deepEqual(
        [...values].sort(),
        [...expected].sort(),
        `a CHECK on ${column} disagrees with src/shared/types.ts. Change both, in the same commit: the type is the source, `
          + 'and a migration that adds a value to an existing CHECK is a table rebuild — a contract step under dev/gates/schema-migrations.ts.',
      );
    }
  });
}
