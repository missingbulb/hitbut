// D1's interface over the SQLite that ships with Node, so a logic or behavior case can
// drive the real corpus code without a Worker in the way.
//
// This fakes the *platform*, never our code: every query, every migration and every
// invariant under test is the shipped one. What it cannot tell you is whether Cloudflare's
// D1 behaves like this SQLite — that gap is why the API's own rules are proven again in
// the server kind, against the real thing, and it is recorded in issue #28.
import { DatabaseSync } from 'node:sqlite';
import type { D1Database, D1PreparedStatement, D1Result } from '../../../src/backend/env.ts';
import { migrationStatements } from './migrations.ts';

class LocalStatement implements D1PreparedStatement {
  #db: DatabaseSync;
  #query: string;
  #values: unknown[] = [];

  constructor(db: DatabaseSync, query: string) {
    this.#db = db;
    this.#query = query;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    this.#values = values.map((value) => (value === undefined ? null : value));
    return this;
  }

  async first<Row = Record<string, unknown>>(): Promise<Row | null> {
    return (this.#db.prepare(this.#query).get(...(this.#values as never[])) as Row) ?? null;
  }

  async all<Row = Record<string, unknown>>(): Promise<D1Result<Row>> {
    return { results: this.#db.prepare(this.#query).all(...(this.#values as never[])) as Row[], success: true };
  }

  async run(): Promise<{ success: boolean }> {
    this.#db.prepare(this.#query).run(...(this.#values as never[]));
    return { success: true };
  }
}

export class LocalD1 implements D1Database {
  #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  prepare(query: string): D1PreparedStatement {
    return new LocalStatement(this.#db, query);
  }

  async batch<Row = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<Row>[]> {
    const results: D1Result<Row>[] = [];
    for (const statement of statements) results.push(await statement.all<Row>());
    return results;
  }

  async exec(query: string): Promise<unknown> {
    this.#db.exec(query);
    return { success: true };
  }
}

/** An empty corpus with the shipped migrations applied, in memory. */
export function migratedDatabase(): LocalD1 {
  const db = new DatabaseSync(':memory:');
  for (const statement of migrationStatements()) db.prepare(statement).run();
  return new LocalD1(db);
}
