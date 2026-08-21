// Every read and write of the corpus. The other three modules import this one and never
// D1 directly, so the invariants that make an id citable — mint once, supersede rather
// than overwrite, retire rather than delete — live in one place.
import type { D1Database } from '../env.ts';
import type { Figure, Judgment, JudgmentKind, Language, Source, Statement } from '../../shared/types.ts';
import { indexText, matchExpression } from '../../shared/text.ts';
import { createUlidFactory, mintFigureId, type Ulid } from './ids.ts';

type Row = Record<string, unknown>;

const parseList = (value: unknown): string[] => (typeof value === 'string' ? JSON.parse(value) : []);

const toFigure = (row: Row): Figure => ({
  id: row.id as string,
  displayName: row.display_name as string,
  role: row.role as string,
  aliases: parseList(row.aliases),
  status: row.status as Figure['status'],
});

const toSource = (row: Row): Source => ({
  id: row.id as string,
  url: row.url as string,
  publisher: row.publisher as string,
  kind: row.kind as Source['kind'],
  fetchedAt: row.fetched_at as string,
  rawKey: row.raw_key as string,
  extraction: row.extraction as Source['extraction'],
});

const toStatement = (row: Row): Statement => ({
  id: row.id as string,
  figureId: row.figure_id as string,
  quote: row.quote as string,
  language: row.language as Language,
  // The column is null when the source establishes no date; it stays null all the way out.
  saidAt: (row.said_at as string | null) ?? null,
  context: (row.context as string | null) ?? null,
  sourceId: row.source_id as string,
  topics: parseList(row.topics),
});

const toJudgment = (row: Row): Judgment => ({
  id: row.id as string,
  figureId: row.figure_id as string,
  earlierStatementId: row.earlier_statement_id as string,
  laterStatementId: row.later_statement_id as string,
  kind: row.kind as JudgmentKind,
  score: row.score as number,
  rationale: row.rationale as string,
  modelVersion: row.model_version as string,
  promptVersion: row.prompt_version as string,
  createdAt: row.created_at as string,
  supersededBy: (row.superseded_by as string | null) ?? null,
  surfaced: row.surfaced === 1,
});

/** One statement as an extractor produced it — everything but the id, which is ours to mint. */
export type ExtractedStatement = {
  /** Position within the payload: with the source it is the statement's natural key. */
  ordinal: number;
  figureId: string;
  quote: string;
  language: Language;
  saidAt: string | null;
  context: string | null;
  topics: string[];
};

export type NewSource = {
  url: string;
  publisher: string;
  kind: Source['kind'];
  fetchedAt: string;
  rawKey: string;
  extraction: Source['extraction'];
  sourceModule: string;
  externalKey: string;
};

export type NewJudgment = {
  figureId: string;
  earlierStatementId: string;
  laterStatementId: string;
  kind: JudgmentKind;
  score: number;
  rationale: string;
  modelVersion: string;
  promptVersion: string;
};

export type Cursor = string | null;

// base64url over UTF-8 bytes, not `btoa` over the string: a figure's id is Hebrew, which
// `btoa` refuses outright, and the result travels in a query parameter.
const encodeCursor = (value: string): string => {
  let binary = '';
  for (const byte of new TextEncoder().encode(value)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const decodeCursor = (cursor: Cursor): string => {
  if (!cursor) return '';
  const binary = atob(cursor.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
};

export class Corpus {
  #db: D1Database;
  #ulid: Ulid;
  #now: () => string;

  constructor(db: D1Database, options: { ulid?: Ulid; now?: () => string } = {}) {
    this.#db = db;
    this.#ulid = options.ulid ?? createUlidFactory();
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  // ---- figures -----------------------------------------------------------------

  /**
   * Creates the figure if the name is new, and otherwise returns the one that already
   * has the slug. Renaming goes through `rename`, which deliberately leaves the id alone.
   */
  async ensureFigure(input: { displayName: string; role: string; aliases?: string[] }): Promise<Figure> {
    const existing = await this.#db
      .prepare('SELECT * FROM figures WHERE display_name = ?')
      .bind(input.displayName)
      .first<Row>();
    if (existing) return toFigure(existing);

    const taken = await this.#db.prepare('SELECT id FROM figures').all<Row>();
    const id = mintFigureId(input.displayName, taken.results.map((row) => row.id as string));
    await this.#db
      .prepare('INSERT INTO figures (id, display_name, role, aliases, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, input.displayName, input.role, JSON.stringify(input.aliases ?? []), 'active', this.#now())
      .run();
    return { id, displayName: input.displayName, role: input.role, aliases: input.aliases ?? [], status: 'active' };
  }

  /** A new name for the same person. The id is a citation and does not move. */
  async rename(id: string, displayName: string): Promise<void> {
    await this.#db.prepare('UPDATE figures SET display_name = ? WHERE id = ?').bind(displayName, id).run();
  }

  /** Withdrawal from the product. The row stays and still resolves by id. */
  async retireFigure(id: string): Promise<void> {
    await this.#db.prepare("UPDATE figures SET status = 'retired' WHERE id = ?").bind(id).run();
  }

  async getFigure(id: string): Promise<Figure | null> {
    const row = await this.#db.prepare('SELECT * FROM figures WHERE id = ?').bind(id).first<Row>();
    return row ? toFigure(row) : null;
  }

  async listFigures(options: { cursor?: Cursor; limit?: number } = {}): Promise<{ figures: Figure[]; nextCursor: Cursor }> {
    const limit = options.limit ?? 20;
    const after = decodeCursor(options.cursor ?? null);
    const rows = await this.#db
      .prepare("SELECT * FROM figures WHERE status = 'active' AND id > ? ORDER BY id LIMIT ?")
      .bind(after, limit + 1)
      .all<Row>();
    const page = rows.results.slice(0, limit);
    const nextCursor = rows.results.length > limit ? encodeCursor(page[page.length - 1].id as string) : null;
    return { figures: page.map(toFigure), nextCursor };
  }

  async figureStats(figureId: string): Promise<{ statementCount: number; flaggedCount: number; topics: string[] }> {
    const counts = await this.#db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM statements WHERE figure_id = ?1) AS statements,
           (SELECT COUNT(*) FROM judgments WHERE figure_id = ?1 AND surfaced = 1 AND superseded_by IS NULL) AS flagged`,
      )
      .bind(figureId)
      .first<Row>();
    const topicRows = await this.#db.prepare('SELECT topics FROM statements WHERE figure_id = ?').bind(figureId).all<Row>();
    const topics = new Set<string>();
    for (const row of topicRows.results) for (const topic of parseList(row.topics)) topics.add(topic);
    return {
      statementCount: Number(counts?.statements ?? 0),
      flaggedCount: Number(counts?.flagged ?? 0),
      topics: [...topics].sort(),
    };
  }

  // ---- sources and statements --------------------------------------------------

  /** What "already fetched" means: the module's own key for the document. */
  async findSource(sourceModule: string, externalKey: string): Promise<Source | null> {
    const row = await this.#db
      .prepare('SELECT * FROM sources WHERE source_module = ? AND external_key = ?')
      .bind(sourceModule, externalKey)
      .first<Row>();
    return row ? toSource(row) : null;
  }

  async getSource(id: string): Promise<Source | null> {
    const row = await this.#db.prepare('SELECT * FROM sources WHERE id = ?').bind(id).first<Row>();
    return row ? toSource(row) : null;
  }

  /** The source plus the bookkeeping the wire does not carry — what a replay needs. */
  async getSourceRecord(id: string): Promise<{ source: Source; sourceModule: string; externalKey: string } | null> {
    const row = await this.#db.prepare('SELECT * FROM sources WHERE id = ?').bind(id).first<Row>();
    return row
      ? { source: toSource(row), sourceModule: row.source_module as string, externalKey: row.external_key as string }
      : null;
  }

  async recordSource(input: NewSource): Promise<Source> {
    const existing = await this.findSource(input.sourceModule, input.externalKey);
    const id = existing?.id ?? this.#ulid();
    await this.#db
      .prepare(
        `INSERT INTO sources (id, url, publisher, kind, fetched_at, raw_key, extraction, source_module, external_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (source_module, external_key)
         DO UPDATE SET url = excluded.url, fetched_at = excluded.fetched_at, raw_key = excluded.raw_key,
                       extraction = excluded.extraction`,
      )
      .bind(id, input.url, input.publisher, input.kind, input.fetchedAt, input.rawKey, input.extraction, input.sourceModule, input.externalKey)
      .run();
    return (await this.getSource(id))!;
  }

  async setExtractionStatus(sourceId: string, extraction: Source['extraction']): Promise<void> {
    await this.#db.prepare('UPDATE sources SET extraction = ? WHERE id = ?').bind(extraction, sourceId).run();
  }

  /**
   * Writes a payload's statements. A statement already recorded at that position in that
   * source keeps the id it was given the first time — which is what makes replaying a
   * fixed extractor over the cached payload safe for anyone who cited it.
   */
  async saveStatements(sourceId: string, extracted: ExtractedStatement[]): Promise<Statement[]> {
    const saved: Statement[] = [];
    for (const item of extracted) {
      const existing = await this.#db
        .prepare('SELECT id FROM statements WHERE source_id = ? AND ordinal = ?')
        .bind(sourceId, item.ordinal)
        .first<Row>();
      const id = (existing?.id as string | undefined) ?? this.#ulid();
      const topics = JSON.stringify(item.topics);
      if (existing) {
        await this.#db
          .prepare('UPDATE statements SET figure_id = ?, quote = ?, language = ?, said_at = ?, context = ?, topics = ? WHERE id = ?')
          .bind(item.figureId, item.quote, item.language, item.saidAt, item.context, topics, id)
          .run();
      } else {
        await this.#db
          .prepare(
            `INSERT INTO statements (id, figure_id, quote, language, said_at, context, source_id, topics, ordinal)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(id, item.figureId, item.quote, item.language, item.saidAt, item.context, sourceId, topics, item.ordinal)
          .run();
      }
      await this.#reindex(id, [item.quote, item.context ?? '', item.topics.join(' ')].join(' '));
      saved.push({ ...item, id, sourceId });
    }
    return saved;
  }

  async #reindex(statementId: string, text: string): Promise<void> {
    await this.#db.prepare('DELETE FROM statements_fts WHERE statement_id = ?').bind(statementId).run();
    await this.#db
      .prepare('INSERT INTO statements_fts (statement_id, search_text) VALUES (?, ?)')
      .bind(statementId, indexText(text))
      .run();
  }

  async getStatement(id: string): Promise<Statement | null> {
    const row = await this.#db.prepare('SELECT * FROM statements WHERE id = ?').bind(id).first<Row>();
    return row ? toStatement(row) : null;
  }

  /** Newest first; a statement whose date is unknown sorts after every dated one. */
  async timeline(figureId: string, limit = 100): Promise<Statement[]> {
    const rows = await this.#db
      .prepare('SELECT * FROM statements WHERE figure_id = ? ORDER BY (said_at IS NULL) ASC, said_at DESC, id DESC LIMIT ?')
      .bind(figureId, limit)
      .all<Row>();
    return rows.results.map(toStatement);
  }

  /** Every other statement by the same figure that shares at least one topic. */
  async candidatePartners(statement: Statement): Promise<Statement[]> {
    const rows = await this.#db
      .prepare('SELECT * FROM statements WHERE figure_id = ? AND id != ?')
      .bind(statement.figureId, statement.id)
      .all<Row>();
    return rows.results
      .map(toStatement)
      .filter((other) => other.topics.some((topic) => statement.topics.includes(topic)));
  }

  /**
   * Search. The folding in `src/shared/text.ts` runs on both the stored text and the
   * query, so a prefixed word reaches a bare one and the reverse. Paging is by offset
   * because the order is relevance, which has no stable key to seek on.
   */
  async search(query: string, options: { cursor?: Cursor; limit?: number } = {}): Promise<{ statements: Statement[]; nextCursor: Cursor }> {
    const limit = options.limit ?? 20;
    const offset = Number(decodeCursor(options.cursor ?? null) || 0);
    const expression = matchExpression(query);
    if (!expression) return { statements: [], nextCursor: null };
    const rows = await this.#db
      .prepare(
        `SELECT statements.* FROM statements_fts
         JOIN statements ON statements.id = statements_fts.statement_id
         WHERE statements_fts MATCH ? ORDER BY rank, statements.id LIMIT ? OFFSET ?`,
      )
      .bind(expression, limit + 1, offset)
      .all<Row>();
    const page = rows.results.slice(0, limit);
    return {
      statements: page.map(toStatement),
      nextCursor: rows.results.length > limit ? encodeCursor(String(offset + limit)) : null,
    };
  }

  /** The whole corpus, joined, for the bulk export snapshot. */
  async exportRows(): Promise<{ statement: Statement; figure: Figure; source: Source }[]> {
    const rows = await this.#db
      .prepare(
        `SELECT statements.*,
                figures.id AS f_id, figures.display_name, figures.role, figures.aliases, figures.status,
                sources.id AS s_id, sources.url, sources.publisher, sources.kind, sources.fetched_at,
                sources.raw_key, sources.extraction
         FROM statements
         JOIN figures ON figures.id = statements.figure_id
         JOIN sources ON sources.id = statements.source_id
         ORDER BY statements.id`,
      )
      .all<Row>();
    return rows.results.map((row) => ({
      statement: toStatement(row),
      figure: toFigure({ ...row, id: row.f_id }),
      source: toSource({ ...row, id: row.s_id }),
    }));
  }

  // ---- judgments ---------------------------------------------------------------

  /**
   * Records what the judge said. Any live judgment about the same pair is marked
   * superseded by this one rather than replaced: the old record keeps its id, its
   * rationale and the model that produced it, so a citation of it stays resolvable.
   */
  async recordJudgment(input: NewJudgment, surfacingThreshold: number): Promise<Judgment> {
    const id = this.#ulid();
    const surfaced = input.kind !== 'consistent' && input.score >= surfacingThreshold;
    const judgment: Judgment = {
      ...input,
      id,
      createdAt: this.#now(),
      supersededBy: null,
      surfaced,
    };
    await this.#db
      .prepare(
        `INSERT INTO judgments (id, figure_id, earlier_statement_id, later_statement_id, kind, score,
                                rationale, model_version, prompt_version, created_at, superseded_by, surfaced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      )
      .bind(id, input.figureId, input.earlierStatementId, input.laterStatementId, input.kind, input.score,
            input.rationale, input.modelVersion, input.promptVersion, judgment.createdAt, surfaced ? 1 : 0)
      .run();
    await this.#db
      .prepare(
        `UPDATE judgments SET superseded_by = ?, surfaced = 0
         WHERE earlier_statement_id = ? AND later_statement_id = ? AND id != ? AND superseded_by IS NULL`,
      )
      .bind(id, input.earlierStatementId, input.laterStatementId, id)
      .run();
    return judgment;
  }

  async getJudgment(id: string): Promise<Judgment | null> {
    const row = await this.#db.prepare('SELECT * FROM judgments WHERE id = ?').bind(id).first<Row>();
    return row ? toJudgment(row) : null;
  }

  /** Every judgment about a pair, oldest first — the audit trail for one comparison. */
  async judgmentsForPair(earlierStatementId: string, laterStatementId: string): Promise<Judgment[]> {
    const rows = await this.#db
      .prepare('SELECT * FROM judgments WHERE earlier_statement_id = ? AND later_statement_id = ? ORDER BY created_at, id')
      .bind(earlierStatementId, laterStatementId)
      .all<Row>();
    return rows.results.map(toJudgment);
  }

  /** What the product shows: live, surfaced judgments, newest first. */
  async listSurfaced(options: { cursor?: Cursor; limit?: number; figureId?: string } = {}): Promise<{ judgments: Judgment[]; nextCursor: Cursor }> {
    const limit = options.limit ?? 20;
    // ULIDs sort by mint time, so paging backwards through them is paging backwards
    // through `created_at`; the sentinel is above every ULID character.
    const after = decodeCursor(options.cursor ?? null) || '~';
    const rows = await this.#db
      .prepare(
        `SELECT * FROM judgments
         WHERE surfaced = 1 AND superseded_by IS NULL AND id < ?1
           AND (?2 IS NULL OR figure_id = ?2)
         ORDER BY id DESC LIMIT ?3`,
      )
      .bind(after, options.figureId ?? null, limit + 1)
      .all<Row>();
    const page = rows.results.slice(0, limit);
    const nextCursor = rows.results.length > limit ? encodeCursor(page[page.length - 1].id as string) : null;
    return { judgments: page.map(toJudgment), nextCursor };
  }

  /** The statements a live surfaced judgment names — what the site marks on a timeline. */
  async flaggedStatementIds(figureId: string): Promise<Set<string>> {
    const rows = await this.#db
      .prepare('SELECT earlier_statement_id, later_statement_id FROM judgments WHERE figure_id = ? AND surfaced = 1 AND superseded_by IS NULL')
      .bind(figureId)
      .all<Row>();
    const flagged = new Set<string>();
    for (const row of rows.results) {
      flagged.add(row.earlier_statement_id as string);
      flagged.add(row.later_statement_id as string);
    }
    return flagged;
  }
}
