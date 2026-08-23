// Does production exist yet? Answers that question and nothing else — it creates nothing,
// changes nothing, and is safe to run any number of times. What production is made of, and
// how each piece is asked about, is `cloudflare.ts`; this file is the report.
//
// Two jobs. Before the first deploy it turns "did I do every step?" into a green check —
// and every `MISS` it reports is something `npm run provision` creates. After the first
// deploy it is the first thing to run when a deploy fails, because most deploy failures are
// a resource or a secret that is not there.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { D1_DATABASE, RESOURCES, look, missing, present, unknown, type Result } from './cloudflare.ts';

const WRANGLER_TOML = fileURLToPath(new URL('../../wrangler.toml', import.meta.url));
const PLACEHOLDER_DATABASE_ID = '00000000-0000-0000-0000-000000000000';
const SECRETS_SETTINGS = 'https://github.com/missingbulb/hitbut/settings/secrets/actions';

type Check = {
  label: string;
  /** A failing optional check reports but does not fail the run — not everything is built yet. */
  required: boolean;
  why: string;
  /** Where to go to fix it: a dashboard page, a settings page, or the command that does it. */
  fix: string;
  run: () => Result;
};

function fromEnvironment(name: string): Result {
  const value = process.env[name];
  return value ? present(`set (${value.length} characters)`) : missing('not set');
}

function databaseIdPinned(): Result {
  const toml = readFileSync(WRANGLER_TOML, 'utf8');
  const id = /database_id\s*=\s*"([^"]+)"/.exec(toml)?.[1];
  if (!id) return unknown('no database_id line in wrangler.toml — has the config changed shape?');
  return id === PLACEHOLDER_DATABASE_ID
    ? missing('still the all-zeros placeholder')
    : present(`pinned to ${id}`);
}

const CHECKS: Check[] = [
  {
    label: 'secret CLOUDFLARE_ACCOUNT_ID',
    required: true,
    why: 'nothing deploys without it, and every check below needs it',
    fix: `paste it at ${SECRETS_SETTINGS}`,
    run: () => fromEnvironment('CLOUDFLARE_ACCOUNT_ID'),
  },
  {
    label: 'secret CLOUDFLARE_API_TOKEN',
    required: true,
    why: 'nothing deploys without it, and every check below needs it',
    fix: `paste it at ${SECRETS_SETTINGS}`,
    run: () => fromEnvironment('CLOUDFLARE_API_TOKEN'),
  },
  {
    label: 'wrangler.toml database_id',
    required: true,
    why: 'the migrate step runs against this id; the placeholder is not a database',
    fix: 'the provision workflow reads the real id back and commits it',
    run: databaseIdPinned,
  },
  ...RESOURCES.map((resource) => ({
    label: resource.label,
    required: resource.required,
    why: resource.why,
    fix: `\`npm run provision\` creates it — or by hand at ${resource.dashboard(process.env.CLOUDFLARE_ACCOUNT_ID)}`,
    run: () => look(resource),
  })),
];

const MARK: Record<Result['state'], string> = { present: 'ok  ', missing: 'MISS', unknown: '??  ' };

const results = CHECKS.map((check) => ({ check, result: check.run() }));

console.log('\nhitbut preflight — reads production, changes nothing\n');
for (const { check, result } of results) {
  console.log(`  [${MARK[result.state]}] ${check.label}`);
  console.log(`         ${result.detail}`);
  if (result.state !== 'present') {
    console.log(`         why it matters: ${check.why}`);
    console.log(`         how to fix it:  ${check.fix}`);
  }
}

const blocking = results.filter(({ check, result }) => check.required && result.state !== 'present');
const advisory = results.filter(({ check, result }) => !check.required && result.state !== 'present');
const unanswered = results.filter(({ result }) => result.state === 'unknown');

console.log('');
if (advisory.length) console.log(`${advisory.length} optional item(s) not ready — expected until the work that needs them lands.`);
if (unanswered.length) {
  console.log(
    `${unanswered.length} check(s) could not be answered. That is not the same as the resource being absent — ` +
      'fix the question (token scope, command name, network) before creating anything. The provisioner ' +
      'refuses to create on an unanswered question for exactly this reason.',
  );
}
if (blocking.length) {
  console.log(`\nNot ready to deploy: ${blocking.map(({ check }) => check.label).join(', ')}`);
  console.log(`Everything above that says MISS is created by the *provision* workflow; ${D1_DATABASE} included.`);
  console.log('The checklist these come from is issue #27.\n');
  process.exit(1);
}
console.log('\nEverything required is in place.\n');
