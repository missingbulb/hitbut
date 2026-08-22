// Every read and write of the corpus. The other three modules import this one and never
// D1 directly, so the invariants that make an id citable — mint once, supersede rather
// than overwrite, retire rather than delete — live in one place.
import type { D1Database } from '../env.ts';
import type {
  Attestation,
  Audience,
  ChangeWindow,
  Cluster,
  ClusterMember,
  Figure,
  Finding,
  FindingKind,
  FindingRole,
  Judgment,
  JudgmentKind,
  Language,
  SaidAt,
  Source,
  Stance,
  Statement,
  Utterance,
  Venue,
} from '../../shared/types.ts';
import { indexText, matchExpression } from '../../shared/text.ts';
import { createUlidFactory, mintFigureId, type Ulid } from './ids.ts';
import { mergeKey } from './utterances.ts';

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


const toCluster = (row: Row): Cluster => ({
  id: row.id as string,
  label: (row.label as string | null) ?? null,
  createdAt: row.created_at as string,
});

const toClusterMember = (row: Row): ClusterMember => ({
  clusterId: row.cluster_id as string,
  utteranceId: row.utterance_id as string,
  distance: (row.distance as number | null) ?? null,
  assignedAt: row.assigned_at as string,
});

const toStance = (row: Row): Stance => ({
  id: row.id as string,
  utteranceId: row.utterance_id as string,
  clusterId: row.cluster_id as string,
  position: row.position as number,
  confidence: row.confidence as number,
  modelVersion: row.model_version as string,
  promptVersion: row.prompt_version as string,
  createdAt: row.created_at as string,
});

/** Needs the rows it rests on, which is why it is not a plain row mapper. */
const toFinding = (row: Row, restsOn: Row[]): Finding => ({
  id: row.id as string,
  figureId: row.figure_id as string,
  clusterId: row.cluster_id as string,
  kind: row.kind as FindingKind,
  rationale: row.rationale as string,
  score: row.score as number,
  venue: (row.venue as Venue | null) ?? null,
  audience: (row.audience as Audience) ?? null,
  // Two nullable columns in the table, one nullable object out here: half an interval is
  // not a claim, so the shape the reader gets cannot express one.
  changed: row.changed_after
    ? { after: row.changed_after as string, before: row.changed_before as string }
    : null,
  restsOn: restsOn.map((member) => ({
    utteranceId: member.utterance_id as string,
    role: member.role as FindingRole,
  })),
  modelVersion: row.model_version as string,
  promptVersion: row.prompt_version as string,
  createdAt: row.created_at as string,
  supersededBy: (row.superseded_by as string | null) ?? null,
  surfaced: row.surfaced === 1,
});

const toUtterance = (row: Row): Utterance => ({
  id: row.id as string,
  figureId: row.figure_id as string,
  text: row.text as string,
  language: row.language as Language,
  // The three states stay three: a date with its precision, or nothing at all.
  saidAt: row.said_at
    ? { value: row.said_at as string, precision: row.said_at_precision as 'day' | 'month' | 'year' }
    : null,
  venue: row.venue as Venue,
  audience: (row.audience as Audience) ?? null,
  createdAt: row.created_at as string,
});

const toAttestation = (row: Row): Attestation => ({
  id: row.id as string,
  utteranceId: row.utterance_id as string,
  sourceId: row.source_id as string,
  text: row.text as string,
  publishedAt: (row.published_at as string | null) ?? null,
  createdAt: row.created_at as string,
});

/** One statement as a document reports it, before we know whether we have heard it before. */
export type ReportedUtterance = {
  figureId: string;
  text: string;
  language: Language;
  saidAt: SaidAt;
  venue: Venue;
  audience?: Audience;
  /** The document reporting it, and the text as that document renders it. */
  sourceId: string;
  attestedText?: string;
  publishedAt?: string | null;
};

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


  // ---- utterances and attestations ---------------------------------------------

  /**
   * Records what a document says was said. If we already hold this utterance — same
   * speaker, same folded words — the document becomes another attestation of it rather
   * than a second copy; and if this document carries it more fully than the one we had,
   * the fuller wording wins, because a quote trimmed for space should not be the record.
   */
  async recordReported(reported: ReportedUtterance): Promise<{ utterance: Utterance; attestation: Attestation; merged: boolean }> {
    const key = mergeKey({ text: reported.text, saidAt: reported.saidAt, venue: reported.venue });
    const existing = await this.#db
      .prepare('SELECT * FROM utterances WHERE figure_id = ? AND merge_key = ?')
      .bind(reported.figureId, key)
      .first<Row>();

    let utterance: Utterance;
    if (existing) {
      if ((reported.text.length) > (existing.text as string).length) {
        await this.#db.prepare('UPDATE utterances SET text = ? WHERE id = ?').bind(reported.text, existing.id).run();
      }
      utterance = (await this.getUtterance(existing.id as string))!;
    } else {
      const id = this.#ulid();
      await this.#db
        .prepare(
          `INSERT INTO utterances (id, figure_id, text, language, said_at, said_at_precision, venue, audience, merge_key, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, reported.figureId, reported.text, reported.language, reported.saidAt?.value ?? null,
              reported.saidAt?.precision ?? null, reported.venue, reported.audience ?? null, key, this.#now())
        .run();
      utterance = (await this.getUtterance(id))!;
    }

    const attestation = await this.#attest(utterance.id, reported);
    return { utterance, attestation, merged: Boolean(existing) };
  }

  async #attest(utteranceId: string, reported: ReportedUtterance): Promise<Attestation> {
    const already = await this.#db
      .prepare('SELECT * FROM attestations WHERE utterance_id = ? AND source_id = ?')
      .bind(utteranceId, reported.sourceId)
      .first<Row>();
    if (already) return toAttestation(already);

    const id = this.#ulid();
    await this.#db
      .prepare('INSERT INTO attestations (id, utterance_id, source_id, text, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, utteranceId, reported.sourceId, reported.attestedText ?? reported.text, reported.publishedAt ?? null, this.#now())
      .run();
    return toAttestation(
      (await this.#db.prepare('SELECT * FROM attestations WHERE id = ?').bind(id).first<Row>())!,
    );
  }

  async getUtterance(id: string): Promise<Utterance | null> {
    const row = await this.#db.prepare('SELECT * FROM utterances WHERE id = ?').bind(id).first<Row>();
    return row ? toUtterance(row) : null;
  }

  /** Every document that reported this utterance, oldest attestation first. */
  async attestationsFor(utteranceId: string): Promise<Attestation[]> {
    const rows = await this.#db
      .prepare('SELECT * FROM attestations WHERE utterance_id = ? ORDER BY id')
      .bind(utteranceId)
      .all<Row>();
    return rows.results.map(toAttestation);
  }

  async utterancesFor(figureId: string): Promise<Utterance[]> {
    const rows = await this.#db
      .prepare('SELECT * FROM utterances WHERE figure_id = ? ORDER BY id')
      .bind(figureId)
      .all<Row>();
    return rows.results.map(toUtterance);
  }

  // ---- clusters, stances and findings --------------------------------------------

  /**
   * Puts an utterance in a cluster. `clusterId` null opens a new one — which is the whole
   * of what "subjects are discovered" means operationally: nothing anywhere is edited to
   * let the corpus be about something new.
   */
  async assignToCluster(
    utteranceId: string,
    clusterId: string | null,
    distance: number | null = null,
  ): Promise<ClusterMember> {
    let target = clusterId;
    if (!target) {
      target = this.#ulid();
      await this.#db
        .prepare('INSERT INTO clusters (id, label, created_at) VALUES (?, NULL, ?)')
        .bind(target, this.#now())
        .run();
    }
    await this.#db
      .prepare(
        `INSERT INTO cluster_members (utterance_id, cluster_id, distance, assigned_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (utterance_id) DO UPDATE SET cluster_id = excluded.cluster_id,
                                                  distance = excluded.distance,
                                                  assigned_at = excluded.assigned_at`,
      )
      .bind(utteranceId, target, distance, this.#now())
      .run();
    return (await this.clusterOf(utteranceId))!;
  }

  async clusterOf(utteranceId: string): Promise<ClusterMember | null> {
    const row = await this.#db
      .prepare('SELECT * FROM cluster_members WHERE utterance_id = ?')
      .bind(utteranceId)
      .first<Row>();
    return row ? toClusterMember(row) : null;
  }

  async getCluster(id: string): Promise<Cluster | null> {
    const row = await this.#db.prepare('SELECT * FROM clusters WHERE id = ?').bind(id).first<Row>();
    return row ? toCluster(row) : null;
  }

  async clusterMembers(clusterId: string): Promise<ClusterMember[]> {
    const rows = await this.#db
      .prepare('SELECT * FROM cluster_members WHERE cluster_id = ? ORDER BY utterance_id')
      .bind(clusterId)
      .all<Row>();
    return rows.results.map(toClusterMember);
  }

  /** The label is display only, regenerated from the members; nothing keys on it. */
  async relabelCluster(id: string, label: string | null): Promise<void> {
    await this.#db.prepare('UPDATE clusters SET label = ? WHERE id = ?').bind(label, id).run();
  }

  /**
   * Records where an utterance sits on its cluster's axis. Re-running the same model and
   * prompt over the same utterance is idempotent; a different model or prompt writes its
   * own row beside the existing one, so no judgment is ever lost behind a re-analysis.
   */
  async recordStance(input: {
    utteranceId: string;
    clusterId: string;
    position: number;
    confidence: number;
    modelVersion: string;
    promptVersion: string;
  }): Promise<Stance> {
    const existing = await this.#db
      .prepare('SELECT * FROM stances WHERE utterance_id = ? AND model_version = ? AND prompt_version = ?')
      .bind(input.utteranceId, input.modelVersion, input.promptVersion)
      .first<Row>();
    if (existing) return toStance(existing);

    const id = this.#ulid();
    await this.#db
      .prepare(
        `INSERT INTO stances (id, utterance_id, cluster_id, position, confidence, model_version, prompt_version, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, input.utteranceId, input.clusterId, input.position, input.confidence,
            input.modelVersion, input.promptVersion, this.#now())
      .run();
    return toStance((await this.#db.prepare('SELECT * FROM stances WHERE id = ?').bind(id).first<Row>())!);
  }

  /** Every stance recorded for one utterance, whichever model produced it. */
  async stancesFor(utteranceId: string): Promise<Stance[]> {
    const rows = await this.#db
      .prepare('SELECT * FROM stances WHERE utterance_id = ? ORDER BY id')
      .bind(utteranceId)
      .all<Row>();
    return rows.results.map(toStance);
  }

  /**
   * One persona's positions on one subject through time — the series both kinds of finding
   * are read off. Ordered by when the utterance was said, with undated utterances last:
   * a series is a claim about time, and an utterance with no date is not on it.
   */
  async stanceSeries(
    figureId: string,
    clusterId: string,
    versions: { modelVersion: string; promptVersion: string },
  ): Promise<{ utterance: Utterance; stance: Stance }[]> {
    const rows = await this.#db
      .prepare(
        `SELECT s.*, u.said_at AS u_said_at FROM stances s
         JOIN utterances u ON u.id = s.utterance_id
         WHERE s.cluster_id = ? AND u.figure_id = ? AND s.model_version = ? AND s.prompt_version = ?
         ORDER BY u.said_at IS NULL, u.said_at, u.id`,
      )
      .bind(clusterId, figureId, versions.modelVersion, versions.promptVersion)
      .all<Row>();
    const series = [];
    for (const row of rows.results) {
      series.push({ utterance: (await this.getUtterance(row.utterance_id as string))!, stance: toStance(row) });
    }
    return series;
  }

  /**
   * Records a finding, superseding any live one about the same persona, subject and kind.
   * The old record keeps its id and everything it said, and gains a pointer to what
   * replaced it, so a citation of it resolves forever.
   *
   * The table refuses a record missing the attribute its kind turns on, so a caller cannot
   * store an anomaly with no venue or a trend change with no interval.
   */
  async recordFinding(
    input: {
      figureId: string;
      clusterId: string;
      kind: FindingKind;
      rationale: string;
      score: number;
      venue?: Venue | null;
      audience?: Audience;
      changed?: ChangeWindow | null;
      restsOn: { utteranceId: string; role: FindingRole }[];
      modelVersion: string;
      promptVersion: string;
    },
    surfacingThreshold: number,
  ): Promise<Finding> {
    const id = this.#ulid();
    await this.#db
      .prepare(
        `INSERT INTO findings (id, figure_id, cluster_id, kind, rationale, score, venue, audience,
                               changed_after, changed_before, model_version, prompt_version,
                               created_at, superseded_by, surfaced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      )
      .bind(id, input.figureId, input.clusterId, input.kind, input.rationale, input.score,
            input.venue ?? null, input.audience ?? null,
            input.changed?.after ?? null, input.changed?.before ?? null,
            input.modelVersion, input.promptVersion, this.#now(),
            input.score >= surfacingThreshold ? 1 : 0)
      .run();

    for (const rests of input.restsOn) {
      await this.#db
        .prepare('INSERT INTO finding_utterances (finding_id, utterance_id, role) VALUES (?, ?, ?)')
        .bind(id, rests.utteranceId, rests.role)
        .run();
    }

    await this.#db
      .prepare(
        `UPDATE findings SET superseded_by = ?, surfaced = 0
         WHERE figure_id = ? AND cluster_id = ? AND kind = ? AND superseded_by IS NULL AND id <> ?`,
      )
      .bind(id, input.figureId, input.clusterId, input.kind, id)
      .run();

    return (await this.getFinding(id))!;
  }

  async getFinding(id: string): Promise<Finding | null> {
    const row = await this.#db.prepare('SELECT * FROM findings WHERE id = ?').bind(id).first<Row>();
    if (!row) return null;
    const rests = await this.#db
      .prepare('SELECT * FROM finding_utterances WHERE finding_id = ? ORDER BY role, utterance_id')
      .bind(id)
      .all<Row>();
    return toFinding(row, rests.results);
  }

  /** The live findings for one persona, newest first. */
  async findingsFor(figureId: string): Promise<Finding[]> {
    const rows = await this.#db
      .prepare('SELECT id FROM findings WHERE figure_id = ? AND superseded_by IS NULL ORDER BY id DESC')
      .bind(figureId)
      .all<Row>();
    const findings = [];
    for (const row of rows.results) findings.push((await this.getFinding(row.id as string))!);
    return findings;
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
