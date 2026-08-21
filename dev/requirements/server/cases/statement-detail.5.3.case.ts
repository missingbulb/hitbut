import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import type { ApiContext } from '../run.test.ts';
import type { StatementDetail } from '../../../../src/shared/api.ts';

export default {
  title: 'GET /statements/{id} returns the quote, its context, and the source it came from',
  async run(api: ApiContext) {
    const detail = await api.json<StatementDetail>(`/api/v1/statements/${api.seeded.statements.lightRailPledge}`);

    assert.equal(detail.statement.quote, 'לא אצביע בעד תקציב שגורע ולו שקל אחד מהרכבת הקלה.');
    assert.equal(detail.statement.saidAt, '2024-03-12');
    assert.equal(detail.statement.context, 'דיון במליאה על הצעת התקציב לשנת 2024.');
    assert.equal(detail.statement.language, 'he');
    assert.equal(detail.figure.displayName, 'אילנה מורג־עציון');
    assert.equal(detail.source.url, 'https://example.org/protocols/2024-03-12');
    assert.equal(detail.source.kind, 'transcript');

    // The undated one arrives without the key at all, so nothing downstream can default it.
    const undated = await api.json<StatementDetail>(`/api/v1/statements/${api.seeded.statements.undatedCommittee}`);
    assert.equal('saidAt' in undated.statement, false);
  },
} satisfies Case<ApiContext>;
