import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withStatement } from '../../shared/fixtures.ts';
import { toWireStatement } from '../../../../src/shared/api.ts';

export default {
  title: 'a statement the source does not date stores no date, and omits it on the wire',
  async run() {
    const corpus = emptyCorpus();
    const { statement } = await withStatement(corpus, 'עמוד ארכיון בלי תאריך.', { saidAt: null });

    const stored = await corpus.getStatement(statement.id);
    assert.equal(stored?.saidAt, null, 'unknown is its own state: not today, not the epoch, not the fetch time');

    const wire = toWireStatement(stored!);
    assert.equal('saidAt' in wire, false, 'the key is absent rather than null, so no consumer can default it');
    assert.equal(JSON.parse(JSON.stringify(wire)).saidAt, undefined);

    // And a real date still travels as one.
    const { statement: dated } = await withStatement(corpus, 'אמירה עם תאריך.', { saidAt: '2026-03-04', ordinal: 1 });
    assert.equal(toWireStatement((await corpus.getStatement(dated.id))!).saidAt, '2026-03-04');
  },
} satisfies Case<void>;
