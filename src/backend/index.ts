// The Worker: one deploy, two entry points. The cron trigger acquires and then reads what
// it acquired; the fetch handler serves the API. No acquisition code sits in the API path
// and no API code sits in a scraper.
import type { Env } from './env.ts';
import { Corpus } from './corpus/store.ts';
import { ROSTER } from './corpus/roster-data.ts';
import { UNPROVISIONED_EMBEDDER, UNPROVISIONED_STANCE, UNPROVISIONED_VECTORS } from './ingestion/unprovisioned.ts';
import { handleRequest } from './api/router.ts';
import { generateUtteranceExport } from './api/export.ts';
import { runAcquisition } from './acquisition/run.ts';
import { productionRegistry } from './acquisition/registry.ts';
import { detect } from './detection/run.ts';

const threshold = (env: Env): number => Number(env.SURFACING_THRESHOLD);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },

  async scheduled(_event: unknown, env: Env): Promise<void> {
    const corpus = new Corpus(env.CORPUS);
    // The roster is an input to every pass, so a reviewed change to who we track — a new
    // person, a rename, a retirement — reaches the corpus on the next run and never
    // through anything a crawl did.
    await corpus.syncRoster(ROSTER);
    const startedAt = new Date().toISOString();
    const outcomes = await runAcquisition({
      corpus,
      raw: env.RAW,
      registry: productionRegistry(),
      roster: ROSTER,
      // Replaced by the real index and models when #27 provisions them. Until then every
      // pass says, per document, which capability it could not reach.
      ingestion: { embedder: UNPROVISIONED_EMBEDDER, vectors: UNPROVISIONED_VECTORS, stance: UNPROVISIONED_STANCE },
      deps: { fetch: (url, init) => fetch(url, init) },
      now: () => new Date().toISOString(),
      fetch: { politenessMs: 800 },
    });
    // A source that declined is a signal for a human; the run still succeeded.
    for (const outcome of outcomes) {
      // Kept rather than logged and dropped: a log stream nobody watches is not a record,
      // and "has this module run at all" is the question the dashboard exists to answer.
      await corpus.recordRun({
        sourceModule: outcome.module,
        startedAt,
        finishedAt: new Date().toISOString(),
        fetched: outcome.fetched,
        cached: outcome.skipped,
        utterances: outcome.utterances,
        unattributed: outcome.unattributed,
        failures: [
          ...outcome.failures.map((failure) => ({ key: failure.key, reason: `${failure.reason}: ${failure.detail}` })),
          // A capability the chain could not reach is a failure of the pass too, and the
          // one most likely to be mistaken for the corpus simply having nothing new.
          ...outcome.incomplete.map((stopped) => ({ key: stopped.utteranceId, reason: stopped.because })),
        ],
      });
      console.log(
        `acquisition ${outcome.module}: fetched ${outcome.fetched}, skipped ${outcome.skipped}, ` +
          `utterances ${outcome.utterances}, unattributed ${outcome.unattributed}, ` +
          `failures ${outcome.failures.map((f) => `${f.key}=${f.reason}`).join(' ') || 'none'}`,
      );
      // Which capability the chain could not reach, once per distinct reason rather than
      // once per utterance — a pass over a thousand documents would otherwise print the
      // same missing binding a thousand times and bury everything else.
      for (const because of new Set(outcome.incomplete.map((stopped) => stopped.because))) {
        const count = outcome.incomplete.filter((stopped) => stopped.because === because).length;
        console.log(`acquisition ${outcome.module}: ${count} utterance(s) stopped — ${because}`);
      }
    }

    // Detection reads what the pass just wrote. Per persona and per subject, because a
    // series is a claim about one person's position on one thing over time — comparing
    // across two people would be reporting that two people disagree, which is not an
    // inconsistency, it is public life.
    //
    // At the same model and prompt the placements were made under: a series that mixed two
    // of them would be measuring the models against each other.
    const versions = { modelVersion: UNPROVISIONED_STANCE.modelVersion, promptVersion: UNPROVISIONED_STANCE.promptVersion };
    let found = 0;
    for (const entry of ROSTER) {
      for (const subject of (await corpus.utteranceStats(entry.id)).subjects) {
        found += (await detect({ corpus, versions, surfacingThreshold: threshold(env) }, entry.id, subject.id)).length;
      }
    }
    console.log(`detection: ${found} finding(s) recorded`);

    console.log(`export: ${await generateUtteranceExport(corpus, env.RAW)} utterances`);
  },
};
