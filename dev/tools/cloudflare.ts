// What production is made of, and how to ask wrangler about it. One table, read by the
// preflight (which only looks) and by the provisioner (which creates what is missing), so
// the two cannot disagree about what production is or what a resource is called.
//
// The distinction the whole file works to preserve is **missing** versus **unknown**: a
// resource we asked about and were told does not exist, versus a question we could not ask
// because the token is wrong, the command moved, or the network refused. Reporting the
// second as the first sends someone to create something that is already there.
import { spawnSync } from 'node:child_process';

export type State = 'present' | 'missing' | 'unknown';
export type Result = { state: State; detail: string };

export const present = (detail: string): Result => ({ state: 'present', detail });
export const missing = (detail: string): Result => ({ state: 'missing', detail });
export const unknown = (detail: string): Result => ({ state: 'unknown', detail });

export type Resource = {
  /** The name Cloudflare knows it by, and what the list output is searched for. */
  name: string;
  label: string;
  /** A failing optional check reports but does not fail the run — not everything is built yet. */
  required: boolean;
  why: string;
  /** Where a human would look at this in the dashboard, given an account id if we have one. */
  dashboard: (accountId?: string) => string;
  /** The wrangler arguments that list this kind of resource. */
  list: string[];
  /** The wrangler arguments that create this one, non-interactively. */
  create: string[];
};

const dashboard =
  (section: string) =>
  (accountId?: string): string =>
    accountId ? `https://dash.cloudflare.com/${accountId}/${section}` : 'https://dash.cloudflare.com/';

export const D1_DATABASE = 'hitbut-corpus';
export const PAGES_PROJECT = 'hitbut';
export const VECTORIZE_INDEX = 'hitbut-utterances';

/**
 * Vectorize fixes an index's dimension count at creation, so the embedding model has to be
 * chosen before the index exists — see #34. Until it is, the provisioner refuses to guess.
 */
export const VECTORIZE_DIMENSIONS = process.env.VECTORIZE_DIMENSIONS;

export const RESOURCES: Resource[] = [
  {
    name: D1_DATABASE,
    label: `D1 database ${D1_DATABASE}`,
    required: true,
    why: 'the corpus; every API route needs it',
    dashboard: dashboard('workers/d1'),
    list: ['d1', 'list'],
    create: ['d1', 'create', D1_DATABASE],
  },
  {
    name: 'hitbut-raw',
    label: 'R2 bucket hitbut-raw',
    required: true,
    why: 'raw payloads land here before anything parses them',
    dashboard: dashboard('r2'),
    list: ['r2', 'bucket', 'list'],
    create: ['r2', 'bucket', 'create', 'hitbut-raw'],
  },
  {
    name: PAGES_PROJECT,
    label: `Pages project ${PAGES_PROJECT}`,
    required: true,
    why: 'there is no site without it, and CI uploads the built dist/ into it',
    dashboard: dashboard('workers-and-pages'),
    list: ['pages', 'project', 'list'],
    // --production-branch is what makes this non-interactive: without it the command asks.
    create: ['pages', 'project', 'create', PAGES_PROJECT, '--production-branch', 'main'],
  },
  {
    name: VECTORIZE_INDEX,
    label: `Vectorize index ${VECTORIZE_INDEX}`,
    // The code that would use it has landed; what is missing is the binding, which arrives
    // with the embedding model (#34). Until then the Worker wires ports that fail by name
    // rather than silently doing nothing.
    required: false,
    why: 'utterance embeddings; ingestion has no retrieval step without it (#34)',
    dashboard: dashboard('workers/vectorize'),
    list: ['vectorize', 'list'],
    create: [
      'vectorize',
      'create',
      VECTORIZE_INDEX,
      '--metric',
      'cosine',
      ...(VECTORIZE_DIMENSIONS ? ['--dimensions', VECTORIZE_DIMENSIONS] : []),
    ],
  },
];

/**
 * The actual reason, out of wrangler's chatter. Wrangler marks its own severity — ✘ for an
 * error, ▲ for a warning — so the error line is identified by its marker rather than
 * guessed at by position or length, both of which pick the banner, the proxy warning or the
 * bug-report boilerplate depending on the day.
 */
// eslint-disable-next-line no-control-regex -- ANSI escapes are exactly what is being stripped
export const stripAnsi = (output: string): string => output.replace(/\u001b\[[0-9;]*m/g, '');

export function firstUsefulLine(output: string): string {
  const lines = stripAnsi(output).split('\n');
  const tidy = (line: string) =>
    line
      .replace(/^[\s\u2718\u25b2\u26c5\ufe0f]+/, '')
      .replace(/^\[?(ERROR|WARNING)\]?\s*/i, '')
      .trim();

  const marked = lines.find((line) => line.includes('\u2718'));
  const reason =
    tidy(marked ?? '') ||
    lines
      .map(tidy)
      .find((line) => line.length > 12 && !/^wrangler \d|Logs were written|create an issue at|telemetry/.test(line)) ||
    '';
  return reason.length > 200 ? `${reason.slice(0, 200)}…` : reason;
}

/**
 * The JSON array in wrangler's output. `--json` still leaves warnings and the version banner
 * around it, and those carry brackets of their own (`[WARNING]`), so this takes the first `[`
 * that actually parses rather than the first `[` there is.
 */
export function jsonArrayIn<T>(output: string): T[] | null {
  const text = stripAnsi(output);
  for (let at = text.indexOf('['); at !== -1; at = text.indexOf('[', at + 1)) {
    try {
      const parsed = JSON.parse(text.slice(at));
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {
      // Not the array; the next bracket might be.
    }
  }
  return null;
}

export type Run = { ok: boolean; output: string; reason: string };

/** Runs wrangler and hands back its whole output, whichever stream it chose. */
export function wrangler(argv: string[], timeout = 180_000): Run {
  const result = spawnSync('npx', ['--no-install', 'wrangler', ...argv], {
    encoding: 'utf8',
    timeout,
    env: process.env,
  });
  if (result.error) {
    return { ok: false, output: '', reason: `could not run \`wrangler ${argv.join(' ')}\`: ${result.error.message}` };
  }
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return {
    ok: result.status === 0,
    output,
    reason: result.status === 0 ? '' : firstUsefulLine(output) || `exit ${result.status}`,
  };
}

/**
 * Asks wrangler to list a kind of resource and looks for the one we need by name.
 * A non-zero exit is never read as "absent" — the question did not get asked.
 */
export function look(resource: Resource): Result {
  const run = wrangler(resource.list, 90_000);
  if (!run.ok) return unknown(`\`wrangler ${resource.list.join(' ')}\` failed — ${run.reason}`);
  return run.output.includes(resource.name)
    ? present(`${resource.name} found`)
    : missing(`${resource.name} is not in the list`);
}

/** What the provisioner is allowed to do about one resource, given what Cloudflare said. */
export type Decision = { act: 'create' | 'leave'; why: string };

/**
 * The two refusals that keep provisioning safe, in one place so a test can hold them:
 * a question that could not be asked is never read as an absence, and a resource whose
 * shape is fixed at creation is never created on a guess.
 */
export function decide(resource: Resource, state: Result): Decision {
  if (state.state === 'present') return { act: 'leave', why: 'already there' };
  if (state.state === 'unknown') {
    return { act: 'leave', why: `${state.detail} — the question could not be asked, so nothing was created` };
  }
  if (resource.name === VECTORIZE_INDEX && !VECTORIZE_DIMENSIONS) {
    return {
      act: 'leave',
      why: 'the embedding model is not chosen, and an index fixes its dimensions at creation (#34)',
    };
  }
  return { act: 'create', why: `wrangler ${resource.create.join(' ')}` };
}
