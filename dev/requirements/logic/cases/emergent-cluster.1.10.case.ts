import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { emptyCorpus, withFigure, withUtterance } from '../../shared/fixtures.ts';

// Two ways of saying the same thing and one about something else entirely. What matters
// here is not that clustering picks the right answer — that is the embedding's job, and
// phase 5's — but that opening a subject the corpus has never held costs no vocabulary
// edit anywhere.
const ABOUT_THE_LINE = 'לא אצביע בעד תקציב שגורע ולו שקל אחד מהרכבת הקלה.';
const ALSO_ABOUT_THE_LINE = 'הרכבת הקלה מעולם לא הייתה בעדיפות שלי.';
const SOMETHING_ELSE = 'ועדת החינוך צריכה להתכנס עוד השבוע.';

export default {
  title: 'a subject is a cluster the corpus opens, not a name chosen in advance',
  async run() {
    const corpus = emptyCorpus();
    const figure = await withFigure(corpus, 'דמות לדוגמה');

    const first = await withUtterance(corpus, figure.id, ABOUT_THE_LINE, { key: 'line-1' });
    const second = await withUtterance(corpus, figure.id, ALSO_ABOUT_THE_LINE, { key: 'line-2' });
    const other = await withUtterance(corpus, figure.id, SOMETHING_ELSE, { key: 'other' });

    // Nothing declared this subject: passing no cluster opens one.
    const opened = await corpus.assignToCluster(first.id, null, 0);
    const joined = await corpus.assignToCluster(second.id, opened.clusterId, 0.11);
    const apart = await corpus.assignToCluster(other.id, null, 0);

    assert.equal(joined.clusterId, opened.clusterId, 'the near utterance joins the existing subject');
    assert.notEqual(apart.clusterId, opened.clusterId, 'and the unrelated one opens its own');
    assert.equal(joined.distance, 0.11, 'the distance it joined at is kept, so the assignment is auditable');

    // A new cluster starts unnamed: a label is regenerated from members, and until there
    // are members worth naming there is nothing honest to call it.
    assert.equal((await corpus.getCluster(opened.clusterId))?.label, null);

    // Relabelling is display only. Everything that joins, compares or cites keys on the id,
    // so a better name must move no data at all.
    const membersBefore = await corpus.clusterMembers(opened.clusterId);
    await corpus.relabelCluster(opened.clusterId, 'הרכבת הקלה');
    const membersAfter = await corpus.clusterMembers(opened.clusterId);

    assert.equal((await corpus.getCluster(opened.clusterId))?.label, 'הרכבת הקלה');
    assert.deepEqual(membersAfter, membersBefore, 'renaming a subject moves nothing');
    assert.equal((await corpus.clusterOf(second.id))?.clusterId, opened.clusterId);
  },
} satisfies Case<void>;
