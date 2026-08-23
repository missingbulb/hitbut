// Creates whatever production is missing. The counterpart to the preflight: same table of
// resources, same question asked of Cloudflare — but where the preflight reports a `MISS`,
// this creates the thing.
//
// Every resource hitbut needs is one non-interactive `wrangler … create`, so none of this
// needs the dashboard; what needs a human is the account, the API token and the decision to
// spend money in that account, which is why this runs from a `workflow_dispatch` rather than
// on its own.
//
// Three rules it will not break:
//
//   * **It cannot destroy anything.** The runner is closed by default — it lists, it creates,
//     it deploys — so no command that removes a database, a bucket, an index or their
//     contents will run, whatever a later edit here asks for. The token it holds could do
//     all of that; this is what stops it.
//   * **It creates only on a confirmed absence.** A resource we could not ask about (a token
//     scope, a renamed command, a refused network) is left alone and reported, because
//     creating a second copy of something that is already there is worse than stopping.
//   * **It never guesses a shape that cannot be changed later.** A Vectorize index fixes its
//     dimension count at creation, so without an explicit `VECTORIZE_DIMENSIONS` it declines
//     rather than pick one.
//
// Usage: `npm run provision` (creates), `npm run provision -- --dry-run` (says what it would).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  D1_DATABASE,
  PLACEHOLDER_DATABASE_ID,
  RESOURCES,
  databaseIdIn,
  decide,
  jsonArrayIn,
  look,
  withDatabaseId,
  wrangler,
} from './cloudflare.ts';

const WRANGLER_TOML = fileURLToPath(new URL('../../wrangler.toml', import.meta.url));
const dryRun = process.argv.includes('--dry-run');

type Outcome = 'already there' | 'created' | 'would create' | 'declined' | 'failed';
const results: { label: string; outcome: Outcome; detail: string }[] = [];
const record = (label: string, outcome: Outcome, detail = '') => {
  results.push({ label, outcome, detail });
  console.log(`  [${outcome.padEnd(12)}] ${label}${detail ? ` — ${detail}` : ''}`);
};

console.log('\nhitbut provision — creates what production is missing, and nothing else\n');
if (dryRun) console.log('  (dry run: nothing will be created)\n');

for (const resource of RESOURCES) {
  const state = look(resource);
  const decision = decide(resource, state);
  if (decision.act === 'leave') {
    record(resource.label, state.state === 'present' ? 'already there' : 'declined', decision.why);
    continue;
  }
  if (dryRun) {
    record(resource.label, 'would create', decision.why);
    continue;
  }
  const run = wrangler(resource.create);
  record(resource.label, run.ok ? 'created' : 'failed', run.ok ? '' : run.reason);
}

/**
 * The one piece of production that lives in the repo rather than in the account: D1 hands
 * out the id when it creates the database, and `wrangler deploy` reads it from the committed
 * config. Resolving it from the database's own name keeps this true whoever created it —
 * a run against an account provisioned by hand writes the same line.
 */
function pinDatabaseId(): void {
  const toml = readFileSync(WRANGLER_TOML, 'utf8');
  const pinned = databaseIdIn(toml);
  if (pinned && pinned !== PLACEHOLDER_DATABASE_ID) {
    record('wrangler.toml database_id', 'already there', `pinned to ${pinned}`);
    return;
  }

  const listed = wrangler(['d1', 'list', '--json'], 90_000);
  if (!listed.ok) {
    record('wrangler.toml database_id', 'declined', `could not read the id back — ${listed.reason}`);
    return;
  }
  const databases = jsonArrayIn<{ uuid?: string; name?: string }>(listed.output);
  if (!databases) {
    record('wrangler.toml database_id', 'failed', '`d1 list --json` printed no list to read');
    return;
  }
  const uuid = databases.find((database) => database.name === D1_DATABASE)?.uuid;
  if (!uuid) {
    record('wrangler.toml database_id', 'declined', `${D1_DATABASE} is not in the account's list yet`);
    return;
  }
  if (dryRun) {
    record('wrangler.toml database_id', 'would create', `would pin ${uuid}`);
    return;
  }
  writeFileSync(WRANGLER_TOML, withDatabaseId(toml, uuid));
  record('wrangler.toml database_id', 'created', `pinned to ${uuid} — commit this`);
}

pinDatabaseId();

const failed = results.filter((result) => result.outcome === 'failed');
const declined = results.filter((result) => result.outcome === 'declined');

console.log('');
if (declined.length) {
  console.log(
    `${declined.length} item(s) declined. Declining is deliberate: an unanswered question or an ` +
      'undecided shape is not the same as an absent resource, and creating on either is the mistake ' +
      'this refuses to make.',
  );
}
if (failed.length) {
  console.log(`\nFailed: ${failed.map((result) => result.label).join(', ')}`);
  process.exit(1);
}
console.log('\nRun the preflight to see production as it now stands.\n');
