// Fetches the committed candidate list and saves what came back, so reconnaissance can
// then happen offline against bytes in the repo.
//
// It exists because the fetching and the reading cannot happen in the same place: agent
// sessions are denied these hosts by their egress policy, and a policy boundary is not
// something to route around. This runs where that is allowed — the `hitbut/fetch-samples`
// task, Action-side — and everything downstream of it reads `dev/samples/payloads/`.
//
// A candidate that refuses us is an answer, not a failure: the run records the reason,
// keeps going, and exits clean. What it will not do is write a refusal to disk as though
// it were a document, which is what the shipped fetcher's bot-wall detection is for.
//
// Usage: `npm run fetch-samples`, or `-- --force` to re-fetch what is already saved,
// `-- --only <id>[,<id>]` to work one candidate.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fetchPage } from '../../src/backend/acquisition/fetcher.ts';

type Candidate = {
  id: string;
  url: string;
  group: string;
  surface: string;
  asks: string;
};

const SAMPLES = fileURLToPath(new URL('../samples/', import.meta.url));
const PAYLOADS = `${SAMPLES}payloads/`;
const CANDIDATES = `${SAMPLES}candidates.json`;
const REPORT = `${SAMPLES}report.GENERATED.md`;

const force = process.argv.includes('--force');
const onlyFlag = process.argv.indexOf('--only');
const only = onlyFlag === -1 ? null : new Set((process.argv[onlyFlag + 1] ?? '').split(',').filter(Boolean));

/**
 * The extension is a claim about what came back, so it is read off the bytes rather than
 * off what the candidate hoped for — an endpoint that answers with a login page is the
 * finding, and naming that file `.json` would hide it.
 */
function extensionFor(body: string): string {
  const head = body.trimStart().slice(0, 400);
  if (head.startsWith('{') || head.startsWith('[')) return 'json';
  if (/^<\?xml|^<(rss|feed|Edmx|edmx)/i.test(head)) return 'xml';
  if (/^<!doctype html|^<html/i.test(head)) return 'html';
  return 'txt';
}

/** Enough of the body to recognise it in the report, on one line. */
const preview = (body: string): string =>
  body.trimStart().slice(0, 220).replace(/\s+/g, ' ').replace(/\|/g, '\\|');

const savedNames = (): string[] => {
  mkdirSync(PAYLOADS, { recursive: true });
  return readdirSync(PAYLOADS);
};

type Outcome = {
  candidate: Candidate;
  state: 'saved' | 'already saved' | 'refused' | 'not fetched';
  detail: string;
  file: string | null;
  bytes: number | null;
};

const file = readFileSync(CANDIDATES, 'utf8');
const candidates: Candidate[] = JSON.parse(file).candidates;
if (!Array.isArray(candidates) || candidates.length === 0) {
  // The list being unusable is our own breakage, unlike a source refusing us.
  throw new Error(`${CANDIDATES} carries no candidates`);
}

const outcomes: Outcome[] = [];
const existing = savedNames();

for (const candidate of candidates) {
  const already = existing.find((name) => name.startsWith(`${candidate.id}.`));
  // The report is a view of the whole list, so a candidate this run did not touch is
  // still reported from what is on disk — a `--only` run must not erase the record of
  // everything it did not ask about.
  if (only && !only.has(candidate.id)) {
    outcomes.push({
      candidate,
      state: already ? 'already saved' : 'not fetched',
      detail: 'outside this run’s --only selection',
      file: already ?? null,
      bytes: already ? readFileSync(`${PAYLOADS}${already}`, 'utf8').length : null,
    });
    continue;
  }
  if (already && !force) {
    outcomes.push({
      candidate,
      state: 'already saved',
      detail: 'no request was issued — pass --force to re-fetch',
      file: already,
      bytes: readFileSync(`${PAYLOADS}${already}`, 'utf8').length,
    });
    console.log(`  [already saved] ${candidate.id}`);
    continue;
  }

  const result = await fetchPage(
    candidate.url,
    { fetch: (url, init) => fetch(url, init) },
    // Slower and more patient than a production pass: this runs by hand, a dozen times
    // in total, against sites we are asking a favour of.
    { attempts: 3, backoffMs: 1000, politenessMs: 2000 },
  );

  if (!result.ok) {
    outcomes.push({
      candidate,
      state: 'refused',
      detail: `${result.reason} — ${result.detail} (after ${result.attempts} attempt${result.attempts === 1 ? '' : 's'})`,
      file: null,
      bytes: null,
    });
    console.log(`  [refused      ] ${candidate.id} — ${result.reason}: ${result.detail}`);
    continue;
  }

  const name = `${candidate.id}.${extensionFor(result.body)}`;
  writeFileSync(`${PAYLOADS}${name}`, result.body);
  outcomes.push({
    candidate,
    state: 'saved',
    detail: `HTTP ${result.status}, ${preview(result.body)}`,
    file: name,
    bytes: result.body.length,
  });
  console.log(`  [saved        ] ${candidate.id} → ${name} (${result.body.length} bytes)`);
}

const lines = [
  '# What the candidate URLs answered',
  '',
  '<!-- Generated by `npm run fetch-samples`. Do not hand-edit: change the candidate list',
  '     or the tool and run the task again. -->',
  '',
  `Fetched ${new Date().toISOString()} by the fetch-samples task, the one place allowed to`,
  'make these requests. A refusal here is a finding to act on, not a broken run: a datacenter IP',
  'being blocked is the expected failure, and the answer to a persistent one is a rendering',
  'proxy configured in `src/backend/acquisition/fetcher.ts`, never a per-source workaround.',
  '',
  '| candidate | group | state | payload | bytes | what came back |',
  '|---|---|---|---|---|---|',
  ...outcomes.map((outcome) =>
    `| \`${outcome.candidate.id}\` | ${outcome.candidate.group} | ${outcome.state} | ${
      outcome.file ? `\`payloads/${outcome.file}\`` : '—'
    } | ${outcome.bytes ?? '—'} | ${outcome.detail} |`,
  ),
  '',
  '## What each candidate was asked',
  '',
  ...outcomes.flatMap((outcome) => [
    `- \`${outcome.candidate.id}\` — ${outcome.candidate.asks}`,
    `  <br>${outcome.candidate.url}`,
  ]),
  '',
];
writeFileSync(REPORT, `${lines.join('\n')}`);

const count = (state: Outcome['state']): number => outcomes.filter((outcome) => outcome.state === state).length;
console.log(
  `\n${count('saved')} saved, ${count('refused')} refused, ${count('already saved')} already there, ` +
    `${count('not fetched')} not asked about.`,
);
console.log(`The report is ${REPORT}.`);
