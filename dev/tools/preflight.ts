// Does production exist yet? Answers that question and nothing else — it creates
// nothing, changes nothing, and is safe to run any number of times.
//
// Two jobs. Before the first deploy it turns "did I do every step of the checklist?"
// into a green check. After one, it is the first thing to run when a deploy fails,
// because most deploy failures are a resource or a secret that is not there.
//
// The distinction it works hardest to preserve is **missing** versus **unknown**: a
// resource we asked about and were told does not exist, versus a question we could not
// ask because the token is wrong, the command moved, or the network refused. Reporting
// the second as the first sends someone to the dashboard to re-create something that is
// already there.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WRANGLER_TOML = fileURLToPath(new URL('../../wrangler.toml', import.meta.url));
const PLACEHOLDER_DATABASE_ID = '00000000-0000-0000-0000-000000000000';

type State = 'present' | 'missing' | 'unknown';
type Result = { state: State; detail: string };

/**
 * Which side of the first deploy a check belongs to. `resources` is everything that must
 * exist *before* anything is deployed; `serving` is what can only be known *after* — the
 * origins, which do not exist until the Worker and the site have been deployed once.
 * Gating the first deploy on a `serving` check would be a deadlock.
 */
type Stage = 'resources' | 'serving';

type Check = {
  label: string;
  stage: Stage;
  /** A failing optional check reports but does not fail the run — not everything is built yet. */
  required: boolean;
  why: string;
  run: () => Result;
};

const present = (detail: string): Result => ({ state: 'present', detail });
const missing = (detail: string): Result => ({ state: 'missing', detail });
const unknown = (detail: string): Result => ({ state: 'unknown', detail });

function fromEnvironment(name: string): Result {
  const value = process.env[name];
  return value ? present(`set (${value.length} characters)`) : missing('not set');
}

/**
 * The actual reason, out of wrangler's chatter. Wrangler marks its own severity — ✘ for
 * an error, ▲ for a warning — so the error line is identified by its marker rather than
 * guessed at by position or length, both of which pick the banner, the proxy warning or
 * the bug-report boilerplate depending on the day.
 */
function firstUsefulLine(output: string): string {
  // eslint-disable-next-line no-control-regex -- ANSI escapes are exactly what is being stripped
  const lines = output.replace(/\u001b\[[0-9;]*m/g, '').split('\n');
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
 * Asks wrangler to list a kind of resource and looks for the one we need by name.
 * A non-zero exit is never read as "absent" — the question did not get asked.
 */
function listContains(argv: string[], name: string): Result {
  const result = spawnSync('npx', ['--no-install', 'wrangler', ...argv], {
    encoding: 'utf8',
    timeout: 90_000,
    env: process.env,
  });
  if (result.error) return unknown(`could not run \`wrangler ${argv.join(' ')}\`: ${result.error.message}`);
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status !== 0) {
    return unknown(`\`wrangler ${argv.join(' ')}\` failed — ${firstUsefulLine(output) || `exit ${result.status}`}`);
  }
  return output.includes(name) ? present(`${name} found`) : missing(`${name} is not in the list`);
}

function databaseIdPinned(): Result {
  const toml = readFileSync(WRANGLER_TOML, 'utf8');
  const id = /database_id\s*=\s*"([^"]+)"/.exec(toml)?.[1];
  if (!id) return unknown('no database_id line in wrangler.toml — has the config changed shape?');
  return id === PLACEHOLDER_DATABASE_ID
    ? missing('still the all-zeros placeholder; paste the real id and merge it')
    : present(`pinned to ${id}`);
}

const CHECKS: Check[] = [
  {
    label: 'secret CLOUDFLARE_ACCOUNT_ID',
    stage: 'resources',
    required: true,
    why: 'nothing deploys without it, and every check below needs it',
    run: () => fromEnvironment('CLOUDFLARE_ACCOUNT_ID'),
  },
  {
    label: 'secret CLOUDFLARE_API_TOKEN',
    stage: 'resources',
    required: true,
    why: 'nothing deploys without it, and every check below needs it',
    run: () => fromEnvironment('CLOUDFLARE_API_TOKEN'),
  },
  {
    label: 'variable API_ORIGIN',
    stage: 'serving',
    required: true,
    why: 'the site is static, so the API origin is baked in at build time',
    run: () => fromEnvironment('API_ORIGIN'),
  },
  {
    label: 'variable SITE_ORIGIN',
    stage: 'serving',
    required: true,
    why: 'the smoke test needs to know where the site landed',
    run: () => fromEnvironment('SITE_ORIGIN'),
  },
  {
    label: 'wrangler.toml database_id',
    stage: 'resources',
    required: true,
    why: 'the migrate step runs against this id; the placeholder is not a database',
    run: databaseIdPinned,
  },
  {
    label: 'D1 database hitbut-corpus',
    stage: 'resources',
    required: true,
    why: 'the corpus; every API route needs it',
    run: () => listContains(['d1', 'list'], 'hitbut-corpus'),
  },
  {
    label: 'R2 bucket hitbut-raw',
    stage: 'resources',
    required: true,
    why: 'raw payloads land here before anything parses them',
    run: () => listContains(['r2', 'bucket', 'list'], 'hitbut-raw'),
  },
  {
    label: 'Pages project hitbut',
    stage: 'resources',
    required: true,
    why: 'a non-interactive runner cannot answer a prompt to create it',
    run: () => listContains(['pages', 'project', 'list'], 'hitbut'),
  },
  {
    label: 'Vectorize index hitbut-utterances',
    stage: 'resources',
    // The code that would use it has landed; what is missing is the binding, which
    // arrives with the account (#27). Until then the Worker wires ports that fail by
    // name rather than silently doing nothing.
    required: false,
    why: 'utterance embeddings; ingestion has no retrieval step without it (#27)',
    run: () => listContains(['vectorize', 'list'], 'hitbut-utterances'),
  },
];

const MARK: Record<State, string> = { present: 'ok  ', missing: 'MISS', unknown: '??  ' };

const stageArgument = process.argv[process.argv.indexOf('--stage') + 1];
const stage = process.argv.includes('--stage') ? (stageArgument as Stage) : undefined;
if (stage && stage !== 'resources' && stage !== 'serving') {
  console.error(`preflight: --stage takes "resources" or "serving", not ${JSON.stringify(stageArgument)}`);
  process.exit(2);
}

const selected = CHECKS.filter((check) => !stage || check.stage === stage);
const results = selected.map((check) => ({ check, result: check.run() }));

console.log(`\nhitbut preflight${stage ? ` (${stage})` : ''} — reads production, changes nothing\n`);
for (const { check, result } of results) {
  console.log(`  [${MARK[result.state]}] ${check.label}`);
  console.log(`         ${result.detail}`);
  if (result.state !== 'present') console.log(`         why it matters: ${check.why}`);
}

const blocking = results.filter(({ check, result }) => check.required && result.state !== 'present');
const advisory = results.filter(({ check, result }) => !check.required && result.state !== 'present');
const unanswered = results.filter(({ result }) => result.state === 'unknown');

console.log('');
if (advisory.length) console.log(`${advisory.length} optional item(s) not ready — expected until the work that needs them lands.`);
if (unanswered.length) {
  console.log(
    `${unanswered.length} check(s) could not be answered. That is not the same as the resource being absent — ` +
      'fix the question (token scope, command name, network) before creating anything.',
  );
}
if (blocking.length) {
  console.log(`\nNot ready to deploy: ${blocking.map(({ check }) => check.label).join(', ')}`);
  console.log('The checklist these come from is issue #27.\n');
  process.exit(1);
}
console.log('\nEverything required is in place.\n');
