// One acquisition pass: for each due source module, fetch what is missing, put the
// verbatim payload in the raw cache, and only then let a parser near it.
//
// A source that fails is a signal for a human, not a broken pipeline — the pass records
// the reason, keeps going, and finishes successfully with a report.
import type { R2Bucket } from '../env.ts';
import type { Corpus } from '../corpus/store.ts';
import { fetchPage, type FetchDeps, type FetchFailure, type FetchOptions } from './fetcher.ts';
import type { SourceModule, SourceRegistry, RawStatement } from './registry.ts';
import type { RosterEntry } from '../corpus/roster.ts';
import { ingest, type IngestDeps, type IngestOutcome } from '../ingestion/pipeline.ts';
import { readSourceDate } from '../corpus/dates.ts';
import { crawlRawKey } from '../raw-keys.ts';

export type ItemFailure = { key: string; url: string; reason: FetchFailure | 'extraction'; detail: string };

export type ModuleOutcome = {
  module: string;
  fetched: number;
  /** Already in the cache and already extracted: no request was issued. */
  skipped: number;
  /** Passages held for a decision because we do not track their speaker. */
  unattributed: number;
  /** Utterances this pass minted. A merge into one we already held is not one of these. */
  utterances: number;
  /** Passages whose ingestion stopped before the last stage, with the reason. */
  incomplete: { utteranceId: string; reached: string; because: string }[];
  failures: ItemFailure[];
};

export type AcquisitionOptions = {
  corpus: Corpus;
  raw: R2Bucket;
  registry: SourceRegistry;
  /** Who we track. An input to the pass, never something the pass adds to. */
  roster: RosterEntry[];
  /** The embedder, vector index and stance model the ingestion chain runs against. */
  ingestion: Omit<IngestDeps, 'corpus'>;
  deps: FetchDeps;
  now: () => string;
  /** Re-fetch documents already in the cache — the only way a changed page is re-read. */
  force?: boolean;
  fetch?: FetchOptions;
};

export async function runAcquisition(options: AcquisitionOptions): Promise<ModuleOutcome[]> {
  const outcomes: ModuleOutcome[] = [];
  for (const module of options.registry.all()) {
    outcomes.push(await runModule(module, options));
  }
  return outcomes;
}

async function runModule(module: SourceModule, options: AcquisitionOptions): Promise<ModuleOutcome> {
  const outcome: ModuleOutcome = {
    module: module.id, fetched: 0, skipped: 0, unattributed: 0,
    utterances: 0, incomplete: [], failures: [],
  };
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
    const rawKey = crawlRawKey(module, document.key, fetchedAt);
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
      outcome.unattributed += saved.unattributed;
      outcome.utterances += saved.utterances;
      outcome.incomplete.push(...saved.incomplete);
    } catch (error) {
      await options.corpus.setExtractionStatus(source.id, 'failed');
      outcome.failures.push({ key: document.key, url: document.url, reason: 'extraction', detail: String(error) });
    }
  }
  return outcome;
}

/**
 * Turn one payload into statements and hand each to analysis.
 *
 * A speaker the roster does not name is neither dropped nor promoted: the passage is held
 * unattributed, under the name the document wrote, for a person to decide about (#31).
 * Acquisition cannot create a figure — that is the whole of the fix, and the reason this
 * function takes the roster rather than reaching for a corpus method that mints one.
 */
async function extractInto(
  options: Pick<AcquisitionOptions, 'corpus' | 'roster' | 'ingestion'>,
  module: SourceModule,
  sourceId: string,
  payload: string,
  document: { key: string; url: string },
): Promise<{ unattributed: number; utterances: number; incomplete: ModuleOutcome['incomplete'] }> {
  const rawStatements: RawStatement[] = module.extract(payload, document);
  const ingested: IngestOutcome[] = [];
  let held = 0;

  for (const raw of rawStatements) {
    const figure = await options.corpus.resolveSpeaker(options.roster, raw.speaker.displayName);
    if (!figure) {
      // Its ordinal goes with it, so the passages that did resolve keep the positions they
      // had in the payload and adding this speaker later moves nobody's id.
      await options.corpus.recordUnattributed(sourceId, {
        speakerName: raw.speaker.displayName,
        speakerRole: raw.speaker.role,
        ordinal: raw.ordinal,
        quote: raw.quote,
        language: raw.language,
        saidAt: raw.saidAt,
        context: raw.context,
      });
      held += 1;
      continue;
    }

    // Ingestion never throws for a stage failure, so a model call that rate-limits cannot
    // cost us the utterance beside it.
    ingested.push(await ingest({ corpus: options.corpus, ...options.ingestion }, {
      figureId: figure.id,
      text: raw.quote,
      language: raw.language,
      saidAt: readSourceDate(raw.saidAt),
      venue: raw.venue ?? module.venue,
      audience: raw.audience ?? null,
      sourceId,
    }));
  }

  await options.corpus.setExtractionStatus(sourceId, 'extracted');

  return {
    unattributed: held,
    utterances: ingested.filter((outcome) => outcome.minted).length,
    incomplete: ingested
      .filter((outcome) => outcome.stoppedBecause !== null)
      .map((outcome) => ({ utteranceId: outcome.utterance.id, reached: outcome.reached, because: outcome.stoppedBecause as string })),
  };
}

/**
 * Re-run an extractor over a payload already in the cache. This is what a parser fix
 * costs: no request, no dependence on a site that has since changed or died. Every stage
 * of ingestion finds its own work already done, so nothing is minted and no model is paid
 * a second time.
 */
export async function reextract(
  options: Pick<AcquisitionOptions, 'corpus' | 'raw' | 'registry' | 'roster' | 'ingestion'>,
  sourceId: string,
): Promise<{ unattributed: number; utterances: number; incomplete: ModuleOutcome['incomplete'] }> {
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
