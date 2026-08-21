// The Worker: one deploy, three entry points. The cron trigger runs acquisition, the
// queue consumer runs analysis, and the fetch handler serves the API — so no acquisition
// code sits in the API path and no API code sits in a scraper.
import type { AnalysisMessage, Env, MessageBatch } from './env.ts';
import { Corpus } from './corpus/store.ts';
import { handleRequest } from './api/router.ts';
import { generateStatementExport } from './api/export.ts';
import { runAcquisition } from './acquisition/run.ts';
import { productionRegistry } from './acquisition/registry.ts';
import { analyzeStatement } from './analysis/run.ts';
import { WorkersAiJudge } from './analysis/judge.ts';

const threshold = (env: Env): number => Number(env.SURFACING_THRESHOLD);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },

  async scheduled(_event: unknown, env: Env): Promise<void> {
    const corpus = new Corpus(env.CORPUS);
    const outcomes = await runAcquisition({
      corpus,
      raw: env.RAW,
      queue: env.ANALYSIS,
      registry: productionRegistry(),
      deps: { fetch: (url, init) => fetch(url, init) },
      now: () => new Date().toISOString(),
      fetch: { politenessMs: 800 },
    });
    // A source that declined is a signal for a human; the run still succeeded.
    for (const outcome of outcomes) {
      console.log(
        `acquisition ${outcome.module}: fetched ${outcome.fetched}, skipped ${outcome.skipped}, ` +
          `statements ${outcome.statements}, failures ${outcome.failures.map((f) => `${f.key}=${f.reason}`).join(' ') || 'none'}`,
      );
    }
    console.log(`export: ${await generateStatementExport(corpus, env.RAW)} statements`);
  },

  async queue(batch: MessageBatch<AnalysisMessage>, env: Env): Promise<void> {
    const corpus = new Corpus(env.CORPUS);
    const judge = new WorkersAiJudge(env.AI, env.JUDGE_MODEL);
    for (const message of batch.messages) {
      try {
        const judgments = await analyzeStatement({ corpus, judge, surfacingThreshold: threshold(env) }, message.body.statementId);
        console.log(`analysis ${message.body.statementId}: ${judgments.length} judgment(s)`);
        message.ack();
      } catch (error) {
        // The statement stays on the queue: a model that failed once is worth asking again,
        // and dropping it would lose the pair silently.
        console.error(`analysis ${message.body.statementId} failed: ${String(error)}`);
        message.retry();
      }
    }
  },
};
