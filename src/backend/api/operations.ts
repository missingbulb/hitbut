// The dashboard's two routes, and the one credential between them.
//
// The split is by what the data is, not by habit. Corpus totals are public because every
// number in them can already be arrived at by walking the corpus API — gating them would
// protect nothing and would stop a researcher citing the size of what they are citing.
// Run outcomes are not, because a failure reason names internals.
import type { Env } from '../env.ts';
import type { Corpus } from '../corpus/store.ts';
import type { SourceRegistry } from '../acquisition/registry.ts';
import type { ModuleState, OperationsView, StatusView } from '../../shared/api.ts';

export async function statusView(corpus: Corpus, now: () => string): Promise<StatusView> {
  return {
    readAt: now(),
    totals: await corpus.corpusTotals(),
    distributions: await corpus.utteranceDistributions(),
  };
}

export async function operationsView(
  corpus: Corpus,
  registry: SourceRegistry,
  now: () => string,
): Promise<OperationsView> {
  const runs = new Map((await corpus.latestRuns()).map((run) => [run.sourceModule, run]));
  // Driven by the registry rather than by the runs table: a module that has never run has
  // no row, and listing only what has rows would hide exactly the module worth noticing.
  const modules: ModuleState[] = registry.all().map((module) => ({
    id: module.id,
    publisher: module.publisher,
    refreshMinutes: module.refreshMinutes,
    lastRun: runs.get(module.id) ?? null,
  }));
  return { readAt: now(), modules };
}

export type Admission = { admitted: true } | { admitted: false; status: number; code: string; message: string };

/**
 * Whether this request may read the operations half.
 *
 * Fails closed on an unset secret and says so, rather than answering: a route that opens
 * when its guard is missing is a route with no guard, and the deploy that forgets the
 * secret is exactly the deploy nobody re-checks.
 */
export function admit(request: Request, env: Env): Admission {
  const configured = env.DASHBOARD_TOKEN;
  if (!configured) {
    return {
      admitted: false,
      status: 503,
      code: 'operations_unconfigured',
      message: 'DASHBOARD_TOKEN is not set on this Worker, so the operations view is closed',
    };
  }
  const offered = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!offered || !sameSecret(offered, configured)) {
    return { admitted: false, status: 401, code: 'unauthorized', message: 'the operations view needs a bearer token' };
  }
  return { admitted: true };
}

/**
 * Compares without returning early on the first differing byte, so how long the answer
 * takes says nothing about how much of the token was right.
 */
function sameSecret(offered: string, configured: string): boolean {
  if (offered.length !== configured.length) return false;
  let difference = 0;
  for (let i = 0; i < offered.length; i++) difference |= offered.charCodeAt(i) ^ configured.charCodeAt(i);
  return difference === 0;
}
