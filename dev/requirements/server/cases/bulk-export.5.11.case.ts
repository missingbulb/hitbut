import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { ErrorBody } from '../../../../src/shared/api.ts';

export default {
  title: 'GET /export/statements.ndjson serves the whole corpus, one JSON object per line',
  async run(api: ApiContext) {
    // Before the scheduled run has written a snapshot the route says so, rather than
    // serving an empty file that reads like an empty corpus.
    const early = await api.get('/api/v1/export/statements.ndjson');
    assert.equal(early.status, 404);
    assert.equal(((await early.json()) as ErrorBody).error.code, 'no_export_yet');

    // The real cron entry point of the real Worker writes it.
    await api.runScheduled();

    const response = await api.get('/api/v1/export/statements.ndjson');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/x-ndjson/);

    const lines = (await response.text()).trim().split('\n');
    assert.equal(lines.length, 9, 'every statement in the sample corpus is a line');
    const records = lines.map((line) => JSON.parse(line));
    const pledge = records.find((record) => record.statement.id === api.seeded.statements.lightRailPledge);
    assert.equal(pledge.figure.displayName, 'אילנה מורג־עציון');
    assert.equal(pledge.source.url, 'https://example.org/protocols/2024-03-12');
    assert.equal(pledge.statement.saidAt, '2024-03-12');

    const undated = records.find((record) => record.statement.id === api.seeded.statements.undatedCommittee);
    assert.equal('saidAt' in undated.statement, false, 'unknown stays unknown in the export too');
  },
} satisfies Case<ApiContext>;
