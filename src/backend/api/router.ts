// The public read-only API. Everything a reader sees — including every page of the site —
// comes through here; the only writers are the cron trigger and the queue consumer, so
// there is no write surface to authenticate and the boundary says so rather than implying
// it by routing failure.
import type { Env } from '../env.ts';
import { Corpus } from '../corpus/store.ts';
import { toWireStatement } from '../../shared/api.ts';
import type {
  ErrorBody,
  FigureDetail,
  FigureSummary,
  InconsistencyDetail,
  InconsistencySummary,
  Page,
  SearchResults,
  StatementDetail,
  TimelineEntry,
} from '../../shared/api.ts';
import { API_BASE } from '../../shared/api.ts';
import { EXPORT_KEY } from './export.ts';

/** Open on purpose: the corpus is public, and researchers read it from their own pages. */
const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...headers },
  });

const fail = (status: number, code: string, message: string): Response =>
  json({ error: { code, message } } satisfies ErrorBody, status);

const pageLimit = (url: URL): number => Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 100);
const cursorOf = (url: URL): string | null => url.searchParams.get('cursor');

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return fail(405, 'method_not_allowed', 'the corpus API is read-only; only GET is served');
  }
  if (!url.pathname.startsWith(API_BASE)) {
    return fail(404, 'not_found', `no route for ${url.pathname}`);
  }

  const path = url.pathname.slice(API_BASE.length).replace(/\/+$/, '');
  const corpus = new Corpus(env.CORPUS);
  // A figure's id is Hebrew, so it arrives percent-encoded and has to be read back before
  // anything is looked up by it. A malformed escape is a bad path, not a crash.
  let segments: string[];
  try {
    segments = path.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return fail(404, 'not_found', `no route for ${url.pathname}`);
  }

  if (segments.length === 0) return json({ service: 'hitbut', version: 'v1' });

  if (segments[0] === 'figures' && segments.length === 1) return listFigures(corpus, url);
  if (segments[0] === 'figures' && segments.length === 2) return figureDetail(corpus, segments[1]);
  if (segments[0] === 'statements' && segments.length === 2) return statementDetail(corpus, segments[1]);
  if (segments[0] === 'inconsistencies' && segments.length === 1) return listInconsistencies(corpus, url);
  if (segments[0] === 'inconsistencies' && segments.length === 2) return inconsistencyDetail(corpus, segments[1]);
  if (segments[0] === 'search' && segments.length === 1) return search(corpus, url);
  if (path === '/export/statements.ndjson') return exportStatements(env);

  return fail(404, 'not_found', `no route for ${url.pathname}`);
}

async function summarise(corpus: Corpus, id: string): Promise<FigureSummary | null> {
  const figure = await corpus.getFigure(id);
  if (!figure) return null;
  const stats = await corpus.figureStats(id);
  return { ...figure, ...stats };
}

async function listFigures(corpus: Corpus, url: URL): Promise<Response> {
  const { figures, nextCursor } = await corpus.listFigures({ cursor: cursorOf(url), limit: pageLimit(url) });
  const items: FigureSummary[] = [];
  for (const figure of figures) {
    const stats = await corpus.figureStats(figure.id);
    items.push({ ...figure, ...stats });
  }
  return json({ items, nextCursor } satisfies Page<FigureSummary>);
}

async function figureDetail(corpus: Corpus, id: string): Promise<Response> {
  const figure = await summarise(corpus, id);
  // A typo must not read as "this person has said nothing".
  if (!figure) return fail(404, 'no_such_figure', `no figure with id ${id}`);
  const statements = await corpus.timeline(id);
  const flagged = await corpus.flaggedStatementIds(id);
  const timeline: TimelineEntry[] = [];
  for (const statement of statements) {
    const source = await corpus.getSource(statement.sourceId);
    if (!source) continue;
    timeline.push({ statement: toWireStatement(statement), source, flagged: flagged.has(statement.id) });
  }
  return json({ figure, timeline } satisfies FigureDetail);
}

async function statementDetail(corpus: Corpus, id: string): Promise<Response> {
  const statement = await corpus.getStatement(id);
  if (!statement) return fail(404, 'no_such_statement', `no statement with id ${id}`);
  const source = await corpus.getSource(statement.sourceId);
  const figure = await corpus.getFigure(statement.figureId);
  if (!source || !figure) return fail(404, 'no_such_statement', `statement ${id} has lost its source or its speaker`);
  return json({ statement: toWireStatement(statement), source, figure } satisfies StatementDetail);
}

async function listInconsistencies(corpus: Corpus, url: URL): Promise<Response> {
  const figureId = url.searchParams.get('figure') ?? undefined;
  const { judgments, nextCursor } = await corpus.listSurfaced({ cursor: cursorOf(url), limit: pageLimit(url), figureId });
  const items: InconsistencySummary[] = [];
  for (const judgment of judgments) {
    const figure = await corpus.getFigure(judgment.figureId);
    const earlier = await corpus.getStatement(judgment.earlierStatementId);
    const later = await corpus.getStatement(judgment.laterStatementId);
    if (!figure || !earlier || !later) continue;
    items.push({ judgment, figure, earlier: toWireStatement(earlier), later: toWireStatement(later) });
  }
  return json({ items, nextCursor } satisfies Page<InconsistencySummary>);
}

async function inconsistencyDetail(corpus: Corpus, id: string): Promise<Response> {
  const judgment = await corpus.getJudgment(id);
  if (!judgment) return fail(404, 'no_such_inconsistency', `no inconsistency with id ${id}`);
  const figure = await corpus.getFigure(judgment.figureId);
  const earlier = await corpus.getStatement(judgment.earlierStatementId);
  const later = await corpus.getStatement(judgment.laterStatementId);
  if (!figure || !earlier || !later) return fail(404, 'no_such_inconsistency', `inconsistency ${id} has lost a statement`);
  const earlierSource = await corpus.getSource(earlier.sourceId);
  const laterSource = await corpus.getSource(later.sourceId);
  if (!earlierSource || !laterSource) return fail(404, 'no_such_inconsistency', `inconsistency ${id} has lost a source`);
  // A superseded judgment still answers, and says what replaced it: a citation degrades
  // to "superseded by", never to a 404.
  const replacement = judgment.supersededBy ? await corpus.getJudgment(judgment.supersededBy) : null;
  return json({
    judgment,
    figure,
    earlier: toWireStatement(earlier),
    later: toWireStatement(later),
    earlierSource,
    laterSource,
    supersededBy: replacement ? { id: replacement.id, createdAt: replacement.createdAt } : null,
  } satisfies InconsistencyDetail);
}

async function search(corpus: Corpus, url: URL): Promise<Response> {
  const query = url.searchParams.get('q') ?? '';
  const { statements, nextCursor } = await corpus.search(query, { cursor: cursorOf(url), limit: pageLimit(url) });
  const hits = [];
  for (const statement of statements) {
    const source = await corpus.getSource(statement.sourceId);
    const figure = await corpus.getFigure(statement.figureId);
    if (!source || !figure) continue;
    hits.push({ statement: toWireStatement(statement), source, figure });
  }
  return json({ query, hits, nextCursor } satisfies SearchResults);
}

async function exportStatements(env: Env): Promise<Response> {
  const object = await env.RAW.get(EXPORT_KEY);
  if (!object) {
    return fail(404, 'no_export_yet', 'the bulk export has not been generated yet; it is written by the scheduled run');
  }
  return new Response(await object.text(), {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', ...CORS },
  });
}
