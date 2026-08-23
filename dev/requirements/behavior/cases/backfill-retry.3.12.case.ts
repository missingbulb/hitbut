import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { backfillWorld } from '../../shared/backfill-harness.ts';
import { payloadOf } from '../../shared/acquisition-harness.ts';
import { runSlice, type Slice } from '../../../../src/backend/backfill/slice.ts';

const SLICE: Slice = { sourceModule: 'fixture-source', from: '2024-01-01', to: '2024-12-31' };

const ARCHIVE = [
  { key: '2024-02-03', url: 'https://example.org/a/2024-02-03', payload: payloadOf([['דמות לדוגמה', '2024-02-03', 'תקציב', 'אמירה ראשונה.']]) },
  { key: '2024-05-19', url: 'https://example.org/a/2024-05-19', payload: payloadOf([['דמות לדוגמה', '2024-05-19', 'תקציב', 'אמירה שנייה.']]) },
  { key: '2024-09-27', url: 'https://example.org/a/2024-09-27', payload: payloadOf([['דמות לדוגמה', '2024-09-27', 'תקציב', 'אמירה שלישית.']]) },
];

export default {
  title: 'a retried backfill step resumes from the documents it had already fetched',
  async run() {
    const world = await backfillWorld(ARCHIVE);

    // The stance model rate-limits, the way a real one does under a backfill. Ingestion
    // reports rather than throws, so the slice still finishes — and every document has been
    // fetched and stored by the time it does.
    world.stance.failWith = '429 too many requests';
    const first = await runSlice(world.deps, world.module, SLICE);

    assert.equal(first.fetched, 3, 'every document in the window was pulled once');
    assert.equal(first.cached, 0, 'and none of them came from the cache, because nothing was in it');
    const requestsAfterFirst = world.http.calls.length;
    assert.equal(requestsAfterFirst, 3);

    // The platform's retry re-runs the whole step. Every fetch inside one is a request to
    // somebody else's server, so this is the difference between one retry and a second
    // crawl of the slice.
    world.stance.failWith = null;
    const retry = await runSlice(world.deps, world.module, SLICE);

    assert.equal(retry.fetched, 0, 'the retry issued no request');
    assert.equal(retry.cached, 3, 'it read what the first attempt stored');
    assert.equal(world.http.calls.length, requestsAfterFirst, 'and the network saw nothing new');

    // And it finished the work the first attempt could not: the utterances were already
    // there, so it mints none, and the stances the rate limit cost are now recorded.
    assert.equal(retry.utterances, 0, 'a replay mints nothing');
    const figure = (await world.corpus.resolveSpeaker(world.deps.roster, 'דמות לדוגמה'))!;
    const utterances = await world.corpus.utterancesFor(figure.id);
    assert.equal(utterances.length, 3, 'three things said, not six');
    for (const utterance of utterances) {
      assert.equal((await world.corpus.stancesFor(utterance.id)).length, 1, `${utterance.id} was placed on the retry`);
    }
  },
} satisfies Case<void>;
