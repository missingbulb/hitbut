// Provisioning creates things in someone's Cloudflare account and reads back where they
// landed, and neither half can be exercised here — there is no account to run against. What
// *can* be held is the reasoning either half does before it acts: when the provisioner is
// allowed to create, and how an origin is read out of what a deploy printed.
//
// The refusals are the point. Creating a resource because a token scope stopped us asking
// about it, or creating a Vectorize index on a guessed dimension count, are both mistakes
// nobody sees until much later — an index's dimensions cannot be changed afterwards.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAGES_PROJECT,
  RESOURCES,
  VECTORIZE_INDEX,
  decide,
  firstUsefulLine,
  missing,
  present,
  unknown,
} from '../tools/cloudflare.ts';
import { deployedSite, deployedWorker, overrideFrom, projectSite } from '../tools/origins.ts';

const resource = (name: string) => {
  const found = RESOURCES.find((candidate) => candidate.name === name);
  assert.ok(found, `no resource named ${name} — has the table changed shape?`);
  return found;
};

test('a resource Cloudflare says is absent is created', () => {
  const bucket = resource('hitbut-raw');
  assert.deepEqual(decide(bucket, missing('hitbut-raw is not in the list')).act, 'create');
});

test('a resource that is already there is left alone', () => {
  assert.equal(decide(resource('hitbut-raw'), present('found')).act, 'leave');
});

test('a question that could not be asked is never read as an absence', () => {
  const decision = decide(resource('hitbut-raw'), unknown('`wrangler r2 bucket list` failed — bad token'));
  assert.equal(decision.act, 'leave');
  assert.match(decision.why, /could not be asked/);
});

test('the Vectorize index is not created on a guessed dimension count', () => {
  assert.equal(process.env.VECTORIZE_DIMENSIONS, undefined, 'this test states what happens when it is unset');
  const decision = decide(resource(VECTORIZE_INDEX), missing('not in the list'));
  assert.equal(decision.act, 'leave');
  assert.match(decision.why, /dimensions at creation/);
});

test('every create command names the resource the check looks for', () => {
  for (const candidate of RESOURCES) {
    assert.ok(
      candidate.create.includes(candidate.name),
      `${candidate.label} would create something other than what the preflight looks for`,
    );
  }
});

test('creating the Pages project cannot stop to ask a question', () => {
  // A prompt on a runner is a hang, not a failure. --production-branch is what removes it.
  assert.ok(resource(PAGES_PROJECT).create.includes('--production-branch'));
});

test("the Worker's origin is read out of what wrangler printed", () => {
  const output = [
    'Total Upload: 92.41 KiB / gzip: 20.11 KiB',
    'Uploaded hitbut-api (3.90 sec)',
    'Deployed hitbut-api triggers (0.31 sec)',
    '  https://hitbut-api.missingbulb.workers.dev',
    'Current Version ID: 7f6b…',
  ].join('\n');
  assert.equal(deployedWorker(output)?.url, 'https://hitbut-api.missingbulb.workers.dev');
});

test("colour codes do not hide the Worker's origin", () => {
  const output = `[32m  https://hitbut-api.missingbulb.workers.dev[0m`;
  assert.equal(deployedWorker(output)?.url, 'https://hitbut-api.missingbulb.workers.dev');
});

test('a deploy that printed no origin is a failure, not an empty string', () => {
  assert.equal(deployedWorker('Uploaded hitbut-api (3.90 sec)'), null);
});

test('a repository variable wins over what was read back', () => {
  assert.equal(overrideFrom('API_ORIGIN', 'https://api.hitbut.example/')?.url, 'https://api.hitbut.example');
  assert.equal(overrideFrom('API_ORIGIN', '  '), null);
  assert.equal(overrideFrom('API_ORIGIN', undefined), null);
});

test("the site's origin is the project's own host, not the deployment's alias", () => {
  const listed = JSON.stringify([{ name: 'other', subdomain: 'other.pages.dev' }, { name: PAGES_PROJECT, subdomain: 'hitbut.pages.dev' }]);
  assert.equal(projectSite(listed, PAGES_PROJECT)?.url, 'https://hitbut.pages.dev');
});

test("wrangler's own warnings do not get read as the list", () => {
  // `--json` output arrives with the banner and any warnings around it, and `[WARNING]` is a
  // bracket too — the first `[` in the output is routinely not the list.
  const noisy = [
    ' ⛅️ wrangler 4.125.0',
    '▲ [WARNING] Proxy environment variables detected.',
    JSON.stringify([{ name: PAGES_PROJECT, subdomain: 'hitbut.pages.dev' }]),
  ].join('\n');
  assert.equal(projectSite(noisy, PAGES_PROJECT)?.url, 'https://hitbut.pages.dev');
});

test('a Pages listing that cannot be read is not an origin', () => {
  assert.equal(projectSite('Authentication error', PAGES_PROJECT), null);
  assert.equal(projectSite(JSON.stringify([{ name: 'somebody-else' }]), PAGES_PROJECT), null);
});

test("falling back to the deployment URL strips the per-deployment label", () => {
  const output = '✨ Deployment complete! Take a peek over at https://a1b2c3d4.hitbut.pages.dev';
  assert.equal(deployedSite(output, PAGES_PROJECT)?.url, 'https://hitbut.pages.dev');
});

test('a deployment URL for another project is not our site', () => {
  assert.equal(deployedSite('https://a1b2c3d4.something-else.pages.dev', PAGES_PROJECT), null);
});

test("wrangler's own error line is what gets reported, not its banner", () => {
  const output = [
    ' ⛅️ wrangler 4.125.0',
    '▲ [WARNING] Proxy environment variables detected.',
    '✘ [ERROR] Authentication error [code: 10000]',
  ].join('\n');
  assert.equal(firstUsefulLine(output), 'Authentication error [code: 10000]');
});
