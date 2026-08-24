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

/** Where a human would look at one part of the account, given an id if we have one. */
export const dashboardUrl = (section: string, accountId?: string): string =>
  accountId ? `https://dash.cloudflare.com/${accountId}/${section}` : 'https://dash.cloudflare.com/';

const dashboard =
  (section: string) =>
  (accountId?: string): string =>
    dashboardUrl(section, accountId);

export const D1_DATABASE = 'hitbut-corpus';
/** What `wrangler.toml` carries until an account has handed out a real one. */
export const PLACEHOLDER_DATABASE_ID = '00000000-0000-0000-0000-000000000000';
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
 * error, ▲ for a warning — so the error line is identified by its marker rather than guessed
 * at by position or length, both of which pick the banner, the proxy warning or the
 * bug-report boilerplate depending on the day.
 *
 * The marked line is a **headline**, and the part that says what to do about it comes on the
 * lines under it: `wrangler r2 bucket list` reports "A request to the Cloudflare API
 * (/accounts/…/r2/buckets) failed." and puts the code that separates a missing token scope
 * from an un-onboarded product underneath. Take the continuation with it, or the report names
 * a failure nobody can act on.
 *
 * A blank line does not end the continuation. Wrangler's own layout puts the URL you are
 * being sent to — the whole actionable half of "register a workers.dev subdomain here:" — on
 * its own line after one. Stop at the next marker, at wrangler's boilerplate, or at a second
 * consecutive blank; a handful of lines is the cap either way.
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

  const noise = /^wrangler \d|Logs were written|create an issue at|telemetry/;
  const at = lines.findIndex((line) => line.includes('\u2718'));

  const CONTINUATION_LINES = 4;
  let reason = '';
  if (at !== -1) {
    const block = [lines[at] as string];
    let blanks = 0;
    for (const line of lines.slice(at + 1)) {
      const next = tidy(line);
      if (!next) {
        if (++blanks > 1) break;
        continue;
      }
      if (/[\u2718\u25b2]/.test(line) || noise.test(next)) break;
      blanks = 0;
      block.push(line);
      if (block.length > CONTINUATION_LINES) break;
    }
    reason = block.map(tidy).filter(Boolean).join(' ');
  }
  reason ||= lines.map(tidy).find((line) => line.length > 12 && !noise.test(line)) || '';
  return reason.length > 400 ? `${reason.slice(0, 400)}…` : reason;
}

/**
 * A read of the Cloudflare API that wrangler has no command for. The workers.dev subdomain is
 * one such fact — there is no `wrangler subdomain`, and a deploy that has nowhere to publish
 * to is exactly what the preflight exists to catch before it happens. GET only: this file's
 * whole point is that nothing here can destroy anything.
 */
export async function accountRead<T>(path: string): Promise<{ ok: true; body: T } | { ok: false; reason: string }> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) return { ok: false, reason: 'no account id or token in the environment' };
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await response.json()) as { success?: boolean; result?: T; errors?: { message?: string }[] };
    if (!response.ok || body.success === false) {
      const said = body.errors?.map((error) => error.message).filter(Boolean).join('; ');
      return { ok: false, reason: said || `HTTP ${response.status}` };
    }
    return { ok: true, body: body.result as T };
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  }
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

export const databaseIdIn = (toml: string): string | null => /database_id\s*=\s*"([^"]+)"/.exec(toml)?.[1] ?? null;

/**
 * The config with the real database id in it. Only the placeholder is ever replaced: an id
 * that is already real is the one production runs against, and pointing a deploy at a
 * different database would strand the corpus in the old one.
 */
export function withDatabaseId(toml: string, uuid: string): string {
  const current = databaseIdIn(toml);
  if (current === null) throw new Error('no database_id line in wrangler.toml — has the config changed shape?');
  return current === PLACEHOLDER_DATABASE_ID ? toml.replace(PLACEHOLDER_DATABASE_ID, uuid) : toml;
}

export type Run = { ok: boolean; output: string; reason: string };

/**
 * Every wrangler command these tools may run. Provisioning holds an API token that can
 * erase the corpus and the raw bucket, so the runner is closed by default: it lists, it
 * creates, it deploys, and a command that is not spelled here does not run — including one
 * a future edit adds without meaning to.
 *
 * A prefix, matched against the argv with flags removed, so `--json` and friends stay free.
 */
export const ALLOWED: readonly (readonly string[])[] = [
  ['d1', 'list'],
  ['d1', 'create'],
  ['r2', 'bucket', 'list'],
  ['r2', 'bucket', 'create'],
  ['vectorize', 'list'],
  ['vectorize', 'create'],
  ['pages', 'project', 'list'],
  ['pages', 'project', 'create'],
  ['pages', 'deploy'],
  ['deploy'],
];

/**
 * The second net, independent of the first: a word that destroys something, wherever it
 * appears. The allowlist alone would already stop these; this is what makes *adding* one to
 * the allowlist by hand fail loudly instead of quietly widening what the token can do.
 */
const DESTRUCTIVE = /^(delete|remove|rm|destroy|drop|purge|truncate|clear|empty|rollback|--force|-f|--yes|-y)$/i;

/** Throws — rather than reports — because a destructive command here is a bug, not an outcome. */
export function assertSafe(argv: readonly string[]): void {
  const destructive = argv.find((token) => DESTRUCTIVE.test(token));
  if (destructive) {
    throw new Error(
      `refusing to run \`wrangler ${argv.join(' ')}\`: "${destructive}" destroys something, and these tools only ` +
        'list, create and deploy. Nothing here is allowed to remove a resource or its contents.',
    );
  }
  const words = argv.filter((token) => !token.startsWith('-'));
  const allowed = ALLOWED.some((command) => command.every((word, at) => words[at] === word));
  if (!allowed) {
    throw new Error(
      `refusing to run \`wrangler ${argv.join(' ')}\`: it is not one of the commands these tools may run ` +
        `(${ALLOWED.map((command) => command.join(' ')).join(', ')}). Add it deliberately if it belongs.`,
    );
  }
}

/** Runs wrangler and hands back its whole output, whichever stream it chose. */
export function wrangler(argv: string[], timeout = 180_000): Run {
  assertSafe(argv);
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
