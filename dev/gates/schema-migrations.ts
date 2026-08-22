// Reading the corpus migrations for what a deploy would do to a Worker that is already
// running. The deploy applies migrations *before* it replaces the Worker, so between
// those two steps the old code is serving against the new schema (issue #37). An
// additive migration survives that window; a drop, a rename or a newly-required column
// does not.
//
// The classification is pure text so the gate beside this file can feed it cases the
// repo does not contain, and the reader is separate from the assertions for the same
// reason `spec.ts` is separate from `coverage.test.ts`.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../src/backend/corpus/migrations/', import.meta.url));

/** The three shapes that break a Worker still running the previous code. */
export type HazardKind = 'drop' | 'rename' | 'required-column';

export type Hazard = {
  kind: HazardKind;
  /** 1-based, into the file as written — comments and all. */
  line: number;
  /** The offending text, for an error message that points at something findable. */
  text: string;
  why: string;
};

export type Migration = {
  name: string;
  /** Names this file declares itself the expand step of, via `-- expand: <name>`. */
  expands: string[];
  /** The expand this file retires, via `-- contract-of: <name>`. */
  contractOf: string | null;
  hazards: Hazard[];
};

/**
 * Blanks out everything a hazard scan must not read — comments and quoted text — keeping
 * every newline, so a hazard's line still points at the source. Comments are blanked in
 * both directions: a migration that *documents* why it avoids a `DROP` must not read as
 * one. SQL comment and quoting syntax, so it shares nothing with the JavaScript-flavoured
 * pass the repo's other scans use.
 */
export function stripSql(sql: string): string {
  const blank = (text: string) => text.replace(/[^\n]/g, ' ');
  const out: string[] = [];
  let i = 0;
  while (i < sql.length) {
    const rest = sql.slice(i, i + 2);
    if (rest === '--') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end;
      out.push(blank(sql.slice(i, stop)));
      i = stop;
    } else if (rest === '/*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      out.push(blank(sql.slice(i, stop)));
      i = stop;
    } else if (sql[i] === "'" || sql[i] === '"') {
      // FTS5's control rows are string literals ('delete'), and an identifier may be
      // quoted; neither is a statement about the schema.
      const quote = sql[i];
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === quote) {
          if (sql[j + 1] === quote) { j += 2; continue; }
          j += 1;
          break;
        }
        j += 1;
      }
      out.push(blank(sql.slice(i, j)));
      i = j;
    } else {
      out.push(sql[i] as string);
      i += 1;
    }
  }
  return out.join('');
}

const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;

const KEYWORD_HAZARDS: { kind: HazardKind; pattern: RegExp; why: string }[] = [
  {
    kind: 'drop',
    pattern: /\bDROP\b[^;]*/gi,
    why: 'the previous Worker is still reading what this removes, for the length of the deploy',
  },
  {
    kind: 'rename',
    pattern: /\bRENAME\b[^;]*/gi,
    why: 'the previous Worker addresses this by its old name, for the length of the deploy',
  },
];

/** Splits on statement boundaries, keeping each statement's offset into the stripped text. */
function statements(stripped: string): { text: string; at: number }[] {
  const found: { text: string; at: number }[] = [];
  let at = 0;
  for (const piece of stripped.split(';')) {
    found.push({ text: piece, at });
    at += piece.length + 1;
  }
  return found;
}

export function hazardsIn(sql: string): Hazard[] {
  const stripped = stripSql(sql);
  const found: Hazard[] = [];

  for (const { kind, pattern, why } of KEYWORD_HAZARDS) {
    for (const match of stripped.matchAll(pattern)) {
      found.push({ kind, line: lineOf(stripped, match.index), text: match[0].trim().replace(/\s+/g, ' '), why });
    }
  }

  // A `NOT NULL` inside `CREATE TABLE` describes a table nothing has written to yet. The
  // same words in an `ALTER TABLE` are a column the running Worker's inserts do not supply.
  for (const { text, at } of statements(stripped)) {
    if (!/^\s*ALTER\s+TABLE\b/i.test(text)) continue;
    const required = /\bNOT\s+NULL\b/i.exec(text);
    if (!required) continue;
    found.push({
      kind: 'required-column',
      line: lineOf(stripped, at + required.index),
      text: text.trim().replace(/\s+/g, ' '),
      why: "the previous Worker's writes do not supply it, so every insert fails for the length of the deploy",
    });
  }

  return found.sort((a, b) => a.line - b.line);
}

/**
 * The step markers, read from the file as written — they are comments, so they are the one
 * thing `stripSql` must not have eaten. Anchored and exact: a marker that has to be guessed
 * at is a marker an author can typo past the gate.
 */
const EXPAND = /^--\s*expand:\s*([a-z0-9][a-z0-9-]*)\s*$/;
const CONTRACT_OF = /^--\s*contract-of:\s*([a-z0-9][a-z0-9-]*)\s*$/;

export function readMigration(name: string, sql: string): Migration {
  const lines = sql.split('\n').map((line) => line.trimEnd());
  return {
    name,
    expands: lines.map((line) => EXPAND.exec(line)?.[1]).filter((n): n is string => Boolean(n)),
    contractOf: lines.map((line) => CONTRACT_OF.exec(line)?.[1]).find(Boolean) ?? null,
    hazards: hazardsIn(sql),
  };
}

/** Every committed migration, in the order the deploy applies them. */
export function readMigrations(): Migration[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readMigration(name, readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8')));
}
