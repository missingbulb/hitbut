// The shipped migrations, as statements a harness can apply to whichever D1 it is
// holding — Node's SQLite for the coded kinds, the real local D1 for the server and
// screen kinds. Reading the same .sql files the deploy applies is the point: a schema
// the tests invented would prove nothing about the one that ships.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { D1Database } from '../../../src/backend/env.ts';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../../src/backend/corpus/migrations/', import.meta.url));

export function migrationStatements(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .flatMap((name) => readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8').split('\n'))
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function applyMigrations(db: D1Database): Promise<void> {
  for (const statement of migrationStatements()) await db.prepare(statement).run();
}
