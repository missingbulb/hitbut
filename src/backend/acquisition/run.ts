// One acquisition pass: for each due source module, fetch what is missing, put the
// verbatim payload in the raw cache, and only then let a parser near it.
//
// A source that fails is a signal for a human, not a broken pipeline — the pass records
// the reason, keeps going, and finishes successfully with a report.
import type { AnalysisMessage, Queue, R2Bucket } from '../env.ts';
import type { Corpus, ExtractedStatement } from '../corpus/store.ts';
import { fetchPage, type FetchDeps, type FetchFailure, type FetchOptions } from './fetcher.ts';
import type { SourceModule, SourceRegistry, RawStatement } from './registry.ts';

export type ItemFailure = { key: string; url: string; reason: FetchFailure | 'extraction'; detail: string };

export type ModuleOutcome = {
  module: string;
  fetched: number;
  /** Already in the cache and already extracted: no request was issued. */
  skipped: number;
  statements: number;
  failures: ItemFailure[];
};

export type AcquisitionOptions = {
  corpus: Corpus;
  raw: R2Bucket;
  queue: Queue<AnalysisMessage>;
  registry: SourceRegistry;
  deps: FetchDeps;
  now: () => string;
  /** Re-fetch documents already in the cache — the only way a changed page is re-read. */
  force?: boolean;
  fetch?: FetchOptions;
};

const rawKeyFor = (module: SourceModule, document: { key: string }, fetchedAt: string): string =>
  `${module.id}/${encodeURIComponent(document.key)}/${fetchedAt}.raw`;

export async function runAcquisition(options: AcquisitionOptions): Promise<ModuleOutcome[]> {
  const outcomes: ModuleOutcome[] = [];
  for (const module of options.registry.all()) {
    outcomes.push(await runModule(module, options));
  }
  return outcomes;
}

async function runModule(module: SourceModule, options: AcquisitionOptions): Promise<ModuleOutcome> {
  const outcome: ModuleOutcome = { module: module.id, fetched: 0, skipped: 0, statements: 0, failures: [] };
  const documents = await module.list();

  for (const document of documents) {
    const known = await options.corpus.findSource(module.id, document.key);
    if (known?.extraction === 'extracted' && !options.force) {
      outcome.skipped += 1;
      continue;
    }

    const result = await fetchPage(document.url, options.deps, options.fetch);
    if (!result.ok) {
      outcome.failures.push({ key: document.key, url: document.url, reason: result.reason, detail: result.detail });
      // Durable, so a blocked source reads as blocked rather than as a source that has
      // never said anything. It is not marked extracted, so the next pass tries again.
      await options.corpus.recordSource({
        url: document.url,
        publisher: module.publisher,
        kind: module.kind,
        fetchedAt: options.now(),
        rawKey: '',
        extraction: result.reason === 'blocked' ? 'blocked' : 'failed',
        sourceModule: module.id,
        externalKey: document.key,
      });
      continue;
    }

    const fetchedAt = options.now();
    const rawKey = rawKeyFor(module, document, fetchedAt);
    // Before anything interprets it: a payload that crashes the parser is still on disk
    // to debug against, and a parser fix replays from here without a request.
    await options.raw.put(rawKey, result.body);

    const source = await options.corpus.recordSource({
      url: document.url,
      publisher: module.publisher,
      kind: module.kind,
      fetchedAt,
      rawKey,
      extraction: 'pending',
      sourceModule: module.id,
      externalKey: document.key,
    });
    outcome.fetched += 1;

    try {
      const saved = await extractInto(options, module, source.id, result.body, document);
      outcome.statements += saved;
    } catch (error) {
      await options.corpus.setExtractionStatus(source.id, 'failed');
      outcome.failures.push({ key: document.key, url: document.url, reason: 'extraction', detail: String(error) });
    }
  }
  return outcome;
}

/** Turn one payload into statements, mint what needs minting, and hand each to analysis. */
async function extractInto(
  options: Pick<AcquisitionOptions, 'corpus' | 'queue'>,
  module: SourceModule,
  sourceId: string,
  payload: string,
  document: { key: string; url: string },
): Promise<number> {
  const rawStatements: RawStatement[] = module.extract(payload, document);
  const extracted: ExtractedStatement[] = [];
  for (const raw of rawStatements) {
    const figure = await options.corpus.ensureFigure({ displayName: raw.speaker.displayName, role: raw.speaker.role });
    extracted.push({
      ordinal: raw.ordinal,
      figureId: figure.id,
      quote: raw.quote,
      language: raw.language,
      saidAt: raw.saidAt,
      context: raw.context,
      topics: raw.topics,
    });
  }
  const saved = await options.corpus.saveStatements(sourceId, extracted);
  await options.corpus.setExtractionStatus(sourceId, 'extracted');
  for (const statement of saved) await options.queue.send({ statementId: statement.id });
  return saved.length;
}

/**
 * Re-run an extractor over a payload already in the cache. This is what a parser fix
 * costs: no request, no dependence on a site that has since changed or died. The
 * statements keep the ids they were given the first time.
 */
export async function reextract(
  options: Pick<AcquisitionOptions, 'corpus' | 'raw' | 'queue' | 'registry'>,
  sourceId: string,
): Promise<number> {
  const record = await options.corpus.getSourceRecord(sourceId);
  if (!record) throw new Error(`no such source: ${sourceId}`);
  const module = options.registry.get(record.sourceModule);
  if (!module) throw new Error(`source ${sourceId} was written by ${record.sourceModule}, which is not registered`);
  const object = await options.raw.get(record.source.rawKey);
  if (!object) throw new Error(`raw payload ${record.source.rawKey} is not in the cache`);
  return extractInto(options, module, sourceId, await object.text(), {
    key: record.externalKey,
    url: record.source.url,
  });
}
