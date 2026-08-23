import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { ErrorBody } from '../../../../src/shared/api.ts';

export default {
  title: 'GET /export/utterances.ndjson serves the whole corpus, one JSON object per utterance',
  async run(api: ApiContext) {
    // Before the scheduled run has written a snapshot the route says so, rather than
    // serving an empty file that reads like an empty corpus.
    const early = await api.get('/api/v1/export/utterances.ndjson');
    assert.equal(early.status, 404);
    assert.equal(((await early.json()) as ErrorBody).error.code, 'no_export_yet');

    // The real cron entry point of the real Worker writes it.
    await api.runScheduled();

    const response = await api.get('/api/v1/export/utterances.ndjson');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/x-ndjson/);

    const lines = (await response.text()).trim().split('\n');
    const records = lines.map((line) => JSON.parse(line));
    assert.equal(
      new Set(records.map((record) => record.utterance.id)).size,
      records.length,
      'one line per thing said — a line per document would put one speech in the file three times',
    );

    const pledge = records.find((record) => record.utterance.id === api.seeded.utterances.lightRailPledge);
    assert.equal(pledge.figure.displayName, 'אילנה מורג־עציון');
    assert.deepEqual(pledge.utterance.saidAt, { value: '2024-03-12', precision: 'day' });
    // Every document that reported it is on the same line, so a researcher reading only
    // the export can still get to each one.
    assert.equal(pledge.attestations.length, 3);
    assert.equal(new Set(pledge.attestations.map((a: { source: { id: string } }) => a.source.id)).size, 3);

    // A date established only to the month keeps its precision here too.
    const monthly = records.find((record) => record.utterance.id === api.seeded.utterances.rally);
    assert.deepEqual(monthly.utterance.saidAt, { value: '2025-04', precision: 'month' });

    const undated = records.find((record) => record.utterance.id === api.seeded.utterances.undatedCommittee);
    assert.equal('saidAt' in undated.utterance, false, 'unknown stays unknown in the export too');
  },
} satisfies Case<ApiContext>;
