// The public read-only API. Everything a reader sees — including every page of the site —
// comes through here; the only writer is the cron trigger, so there is no write surface
// to authenticate and the boundary says so rather than implying
// it by routing failure.
import type { Env } from '../env.ts';
import { Corpus } from '../corpus/store.ts';
import { toWireUtterance } from '../../shared/api.ts';
import type {
  ErrorBody,
  FigureRecord,
  FigureSummary,
  FindingDetail,
  FindingSummary,
  FindingUtterance,
  Page,
  UtteranceDetail,
  UtteranceHit,
  UtteranceSearchResults,
  RosterView,
  UtteranceTimelineEntry,
  WireAttestation,
} from '../../shared/api.ts';
import { API_BASE } from '../../shared/api.ts';
import { EXPORT_KEY } from './export.ts';
import { admit, operationsView, statusView } from './operations.ts';
import { productionRegistry } from '../acquisition/registry.ts';
import { INCLUSION_RULE } from '../corpus/roster-data.ts';

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

const now = () => new Date().toISOString();

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
  if (segments[0] === 'roster' && segments.length === 1) return roster(corpus);
  if (segments[0] === 'figures' && segments.length === 2) return figureDetail(corpus, segments[1]);
  if (segments[0] === 'utterances' && segments.length === 2) return utteranceDetail(corpus, segments[1]);
  if (segments[0] === 'findings' && segments.length === 1) return listFindings(corpus, url);
  if (segments[0] === 'findings' && segments.length === 2) return findingDetail(corpus, segments[1]);
  if (segments[0] === 'search' && segments.length === 1) return search(corpus, url);
  if (segments[0] === 'status' && segments.length === 1) return json(await statusView(corpus, now));
  if (segments[0] === 'operations' && segments.length === 1) return operations(request, env, corpus);
  if (path === '/export/utterances.ndjson') return exportUtterances(env);

  return fail(404, 'not_found', `no route for ${url.pathname}`);
}

async function summarise(corpus: Corpus, id: string): Promise<FigureSummary | null> {
  const figure = await corpus.getFigure(id);
  if (!figure) return null;
  const stats = await corpus.utteranceStats(id);
  return { ...figure, ...stats };
}

async function listFigures(corpus: Corpus, url: URL): Promise<Response> {
  const { figures, nextCursor } = await corpus.listFigures({ cursor: cursorOf(url), limit: pageLimit(url) });
  const items: FigureSummary[] = [];
  for (const figure of figures) {
    const stats = await corpus.utteranceStats(figure.id);
    items.push({ ...figure, ...stats });
  }
  return json({ items, nextCursor } satisfies Page<FigureSummary>);
}

async function roster(corpus: Corpus): Promise<Response> {
  const { figures } = await corpus.listFigures({ limit: 500 });
  const items: FigureSummary[] = [];
  for (const figure of figures) items.push({ ...figure, ...(await corpus.utteranceStats(figure.id)) });
  return json({ inclusionRule: INCLUSION_RULE, figures: items } satisfies RosterView);
}

async function figureDetail(corpus: Corpus, id: string): Promise<Response> {
  const figure = await summarise(corpus, id);
  // A typo must not read as "this person has said nothing".
  if (!figure) return fail(404, 'no_such_figure', `no figure with id ${id}`);
  const flagged = await corpus.flaggedUtteranceIds(id);
  const timeline: UtteranceTimelineEntry[] = [];
  for (const utterance of await corpus.utteranceTimeline(id)) {
    timeline.push({
      utterance: toWireUtterance(utterance),
      publishers: await publishersOf(corpus, utterance.id),
      flagged: flagged.has(utterance.id),
    });
  }
  return json({ figure, timeline } satisfies FigureRecord);
}

/** Who carried an utterance, named, in the order the documents arrived. */
async function publishersOf(corpus: Corpus, utteranceId: string): Promise<string[]> {
  return (await attestationsOf(corpus, utteranceId)).map(({ source }) => source.publisher);
}

/** The documents that reported an utterance, each with the source it is. */
async function attestationsOf(corpus: Corpus, utteranceId: string): Promise<WireAttestation[]> {
  const found: WireAttestation[] = [];
  for (const attestation of await corpus.attestationsFor(utteranceId)) {
    const source = await corpus.getSource(attestation.sourceId);
    if (source) found.push({ attestation, source });
  }
  return found;
}

async function utteranceDetail(corpus: Corpus, id: string): Promise<Response> {
  const utterance = await corpus.getUtterance(id);
  if (!utterance) return fail(404, 'no_such_utterance', `no utterance with id ${id}`);
  const figure = await corpus.getFigure(utterance.figureId);
  if (!figure) return fail(404, 'no_such_utterance', `utterance ${id} has lost its speaker`);

  const member = await corpus.clusterOf(id);
  const cluster = member ? await corpus.getCluster(member.clusterId) : null;

  return json({
    utterance: toWireUtterance(utterance),
    figure,
    attestations: await attestationsOf(corpus, id),
    // Null before the chain has placed it. A subject nothing assigned is not a subject
    // called "unknown" — the page says the utterance has not been placed yet.
    subject: cluster ? { id: cluster.id, label: cluster.label } : null,
  } satisfies UtteranceDetail);
}

/** A finding with the utterances it rests on, each resolved and carrying its documents. */
async function resolve(corpus: Corpus, finding: Awaited<ReturnType<Corpus['getFinding']>>): Promise<FindingSummary | null> {
  if (!finding) return null;
  const figure = await corpus.getFigure(finding.figureId);
  if (!figure) return null;

  const restsOn: FindingUtterance[] = [];
  for (const rests of finding.restsOn) {
    const utterance = await corpus.getUtterance(rests.utteranceId);
    if (!utterance) continue;
    restsOn.push({
      utterance: toWireUtterance(utterance),
      role: rests.role,
      attestations: await attestationsOf(corpus, utterance.id),
    });
  }
  // A finding whose utterances cannot be resolved is not a finding anybody can check, and
  // the product's claim is that every one of them can be.
  if (restsOn.length !== finding.restsOn.length) return null;

  return { finding, figure, restsOn };
}

async function listFindings(corpus: Corpus, url: URL): Promise<Response> {
  const figureId = url.searchParams.get('figure') ?? undefined;
  const { findings, nextCursor } = await corpus.listFindings({ cursor: cursorOf(url), limit: pageLimit(url), figureId });
  const items: FindingSummary[] = [];
  for (const finding of findings) {
    const resolved = await resolve(corpus, finding);
    if (resolved) items.push(resolved);
  }
  return json({ items, nextCursor } satisfies Page<FindingSummary>);
}

async function findingDetail(corpus: Corpus, id: string): Promise<Response> {
  const finding = await corpus.getFinding(id);
  const resolved = await resolve(corpus, finding);
  if (!finding || !resolved) return fail(404, 'no_such_finding', `no finding with id ${id}`);
  // A superseded finding still answers, and says what replaced it: a citation degrades to
  // "superseded by", never to a 404.
  const replacement = finding.supersededBy ? await corpus.getFinding(finding.supersededBy) : null;
  return json({
    ...resolved,
    supersededBy: replacement ? { id: replacement.id, createdAt: replacement.createdAt } : null,
  } satisfies FindingDetail);
}

async function search(corpus: Corpus, url: URL): Promise<Response> {
  const query = url.searchParams.get('q') ?? '';
  const { utterances, nextCursor } = await corpus.searchUtterances(query, { cursor: cursorOf(url), limit: pageLimit(url) });
  const hits: UtteranceHit[] = [];
  for (const utterance of utterances) {
    const figure = await corpus.getFigure(utterance.figureId);
    if (!figure) continue;
    hits.push({
      utterance: toWireUtterance(utterance),
      figure,
      publishers: await publishersOf(corpus, utterance.id),
    });
  }
  return json({ query, hits, nextCursor } satisfies UtteranceSearchResults);
}

/** The credentialled half: what each source module last did, refusals included. */
async function operations(request: Request, env: Env, corpus: Corpus): Promise<Response> {
  const admission = admit(request, env);
  if (!admission.admitted) return fail(admission.status, admission.code, admission.message);
  return json(await operationsView(corpus, productionRegistry(), now));
}

async function exportUtterances(env: Env): Promise<Response> {
  const object = await env.RAW.get(EXPORT_KEY);
  if (!object) {
    return fail(404, 'no_export_yet', 'the bulk export has not been generated yet; it is written by the scheduled run');
  }
  return new Response(await object.text(), {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', ...CORS },
  });
}
