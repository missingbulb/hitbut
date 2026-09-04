// What the harness itself is proven by, so a number it reports later is a number about the
// model and not about the arithmetic: the metrics on hand-computable inputs, the paper's
// measure on the paper's own worked example, and the whole protocol on a set small enough
// to check by hand.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Embedder } from '../../src/backend/ingestion/ports.ts';
import { compare, renderReport } from './compare.ts';
import { syntacticSemanticJaccard, type Equivalent } from './measure.ts';
import { recallAtK, reciprocalRank, scorecard, separation } from './metrics.ts';
import { embeddingRetriever, lexicalDistance, lexicalJudge, lexicalRetriever, logicalJudge, type ClauseModel } from './methods.ts';
import { claimsOf, parsePairs, readPairs, type LabelledPair } from './pairs.ts';
import { SAMPLE_PAIRS, resolveMethods } from './run.ts';

test('recall@k and reciprocal rank read a ranking the obvious way', () => {
  const relevant = new Set(['b', 'd']);
  assert.equal(recallAtK(['a', 'b', 'c', 'd'], relevant, 2), 0.5);
  assert.equal(recallAtK(['a', 'b', 'c', 'd'], relevant, 4), 1);
  assert.equal(recallAtK(['a', 'c'], relevant, 2), 0);
  assert.equal(reciprocalRank(['a', 'b', 'c', 'd'], relevant), 0.5);
  assert.equal(reciprocalRank(['a', 'c'], relevant), 0);
  assert.throws(() => recallAtK(['a'], new Set(), 1), /undefined/);
});

test('separation is the probability a near pair scores below a far one, ties counting half', () => {
  assert.equal(separation([0.1, 0.2], [0.8, 0.9]), 1);
  assert.equal(separation([0.8, 0.9], [0.1, 0.2]), 0);
  assert.equal(separation([0.5], [0.5]), 0.5);
  // Three of four comparisons the right way round.
  assert.equal(separation([0.1, 0.7], [0.5, 0.9]), 0.75);
});

test('the scorecard counts precision and recall per relation and reads contradiction recall on its own', () => {
  const card = scorecard(
    ['contradicts', 'contradicts', 'equivalent', 'unrelated'],
    ['contradicts', 'unrelated', 'equivalent', 'unrelated'],
  );
  assert.equal(card.perRelation.contradicts.recall, 0.5);
  assert.equal(card.perRelation.contradicts.precision, 1);
  assert.equal(card.perRelation.unrelated.precision, 0.5);
  assert.equal(card.perRelation.equivalent.f1, 1);
  // Relations with no gold pair are left out of the macro average rather than dragging it to zero.
  assert.equal(card.perRelation.entails.support, 0);
  assert.equal(card.macroF1, (2 / 3 + 1 + 2 / 3) / 3);
  assert.equal(card.contradictionRecall, 0.5);
});

test("the paper's worked example: one shared premise class of two, equivalent conclusions, sigma one half gives 0.75", async () => {
  // Figure 4 of arXiv 2608.15325: argument 77 has premises p1, p2 and conclusion c; argument
  // 4612 has premises q1, q2 and conclusion d. p2 is mutually entailed with both q1 and q2,
  // p1 with neither; c and d are mutually entailed.
  const equivalences = new Set(['p2|q1', 'p2|q2', 'c|d']);
  const equivalent: Equivalent = async (x, y) => equivalences.has(`${x}|${y}`) || equivalences.has(`${y}|${x}`);
  const result = await syntacticSemanticJaccard(
    { premises: ['p1', 'p2'], consequences: ['c'] },
    { premises: ['q1', 'q2'], consequences: ['d'] },
    equivalent,
  );
  assert.equal(result.similarity, 0.75);
  assert.deepEqual({ shared: result.premises.shared, distinct: result.premises.distinct }, { shared: 1, distinct: 2 });
  assert.deepEqual({ shared: result.consequences.shared, distinct: result.consequences.distinct }, { shared: 1, distinct: 1 });
});

test("the paper's Figure 3: the same number of mutual entailments scores a half when they cover half the classes and one when they cover all", async () => {
  const premisesOnly = async (pairs: string[]) => {
    const set = new Set(pairs);
    const equivalent: Equivalent = async (x, y) => set.has(`${x}|${y}`);
    // Empty consequence sets on both sides contribute a full second half, so read the premise half alone.
    const result = await syntacticSemanticJaccard({ premises: ['p1', 'p2'], consequences: [] }, { premises: ['q1', 'q2'], consequences: [] }, equivalent);
    return result.similarity - 0.5;
  };
  assert.equal(await premisesOnly(['p1|q1', 'p1|q2']), 0.25);
  assert.equal(await premisesOnly(['p1|q1', 'p2|q2']), 0.5);
});

test('the measure is one exactly for equivalent arguments and zero for disjoint ones', async () => {
  const same: Equivalent = async (x, y) => x === y;
  const alike = await syntacticSemanticJaccard({ premises: ['p'], consequences: ['c'] }, { premises: ['p'], consequences: ['c'] }, same);
  const apart = await syntacticSemanticJaccard({ premises: ['p'], consequences: ['c'] }, { premises: ['q'], consequences: ['d'] }, same);
  assert.equal(alike.similarity, 1);
  assert.equal(apart.similarity, 0);
  await assert.rejects(syntacticSemanticJaccard({ premises: [], consequences: [] }, { premises: [], consequences: [] }, same, 1), /sigma/);
});

test('lexical distance folds Hebrew the way the search index does', () => {
  // A clitic on the front leaves the stem shared: the two are near, though the surface tokens differ.
  assert.ok(lexicalDistance('כנסת', 'בכנסת') < 0.5);
  assert.equal(lexicalDistance('ירושלים', 'ירושלימ'), 0);
  assert.ok(lexicalDistance('תקציב החינוך יגדל', 'תקציב החינוך יקוצץ') < 0.5);
  assert.equal(lexicalDistance('רכבת', 'חינוך'), 1);
});

test('a pair set is refused at the door when a record does not say what it claims', () => {
  const good = '{"id":"p1","a":{"id":"a","utteranceId":"u","text":"x"},"b":{"id":"b","utteranceId":"u","text":"y"},"relation":"unrelated"}';
  assert.equal(parsePairs(good).length, 1);
  assert.throws(() => parsePairs(good.replace('"unrelated"', '"similar"'), 'set'), /set:1: relation must be one of/);
  assert.throws(() => parsePairs(`${good}\n${good}`), /:2: pair id p1 appears twice/);
  assert.throws(() => parsePairs(good.replace('"id":"b"', '"id":"a"')), /two different claims/);
  assert.throws(() => parsePairs('not json'), /:1: not JSON/);
  const twoTexts = `${good}\n${good.replace('"id":"p1"', '"id":"p2"').replace('"text":"y"', '"text":"z"')}`;
  assert.throws(() => claimsOf(parsePairs(twoTexts)), /claim b has two texts/);
});

/** Four claims, hand-checkable: two about trains, two about schools; one contradiction in each subject. */
const TINY: LabelledPair[] = parsePairs(
  [
    '{"id":"t1","a":{"id":"a","utteranceId":"u","text":"הרכבת תיפתח בינואר"},"b":{"id":"b","utteranceId":"u","text":"הרכבת לא תיפתח בינואר"},"relation":"contradicts"}',
    '{"id":"t2","a":{"id":"c","utteranceId":"u","text":"תקציב החינוך יגדל"},"b":{"id":"d","utteranceId":"u","text":"תקציב החינוך יקוצץ"},"relation":"contradicts"}',
    '{"id":"t3","a":{"id":"a","utteranceId":"u","text":"הרכבת תיפתח בינואר"},"b":{"id":"c","utteranceId":"u","text":"תקציב החינוך יגדל"},"relation":"unrelated"}',
    '{"id":"t4","a":{"id":"b","utteranceId":"u","text":"הרכבת לא תיפתח בינואר"},"b":{"id":"d","utteranceId":"u","text":"תקציב החינוך יקוצץ"},"relation":"unrelated"}',
  ].join('\n'),
);

test('the protocol over a tiny set: lexical retrieval finds every partner, and its judge sees no contradiction', async () => {
  const report = await compare(TINY, { retrievers: [lexicalRetriever()], judges: [lexicalJudge()] });
  assert.deepEqual(report.pairs, { count: 4, claims: 4, byRelation: { equivalent: 0, entails: 0, contradicts: 2, 'same-subject': 0, unrelated: 2 } });

  const lexical = report.retrieval.lexical;
  // Each claim's one partner shares two of three words and is nearest; recall is full at every depth.
  assert.deepEqual(lexical.recallAt, { 5: 1, 20: 1, 100: 1 });
  assert.equal(lexical.mrr, 1);
  assert.equal(lexical.subjectSeparation, 1);
  assert.equal(lexical.queries, 4);
  assert.deepEqual(lexical.cost, { calls: 0, characters: 0 });

  const judged = report.judgment.lexical;
  assert.equal(judged.contradictionRecall, 0);
  assert.equal(judged.perRelation.unrelated.recall, 1);
  assert.match(renderReport(report), /\| lexical \| 100\.0% \| 100\.0% \| 100\.0% \| 1\.000 \| 100\.0% \| 4 \| 0 \| 0 \|/);
});

test('an embedding retriever is scored through the ingestion port and pays once per claim', async () => {
  // A scripted embedder that puts the two train claims on one axis and the two school claims on another.
  const embedder: Embedder = {
    modelVersion: 'scripted/axes',
    async embed(text) {
      return [text.includes('רכבת') ? 1 : 0, text.includes('חינוך') ? 1 : 0];
    },
  };
  const retriever = embeddingRetriever(embedder);
  const report = await compare(TINY, { retrievers: [retriever], judges: [] });
  const result = report.retrieval['embedding:scripted/axes'];
  assert.equal(result.recallAt[5], 1);
  assert.equal(result.subjectSeparation, 1);
  // Four distinct claims, each embedded once however many pairs it appears in.
  const characters = claimsOf(TINY).reduce((sum, claim) => sum + claim.text.length, 0);
  assert.deepEqual(result.cost, { calls: 4, characters });
});

test("the paper's method as a judge: a scripted clause model yields the relation and the trail, and pays per clause pair", async () => {
  const model: ClauseModel = {
    modelVersion: 'scripted/clauses',
    promptVersion: 'decompose-v0',
    async decompose(text) {
      const negated = text.includes('לא');
      return { premises: ['הממשלה התחייבה'], consequences: [negated ? 'הרכבת לא נפתחת' : 'הרכבת נפתחת'] };
    },
    async relate(p, q) {
      if (p === q) return 'entails';
      if (p.includes('רכבת') && q.includes('רכבת')) return 'contradicts';
      return 'neutral';
    },
  };
  const judge = logicalJudge(model);
  const [pair] = TINY;
  const verdict = await judge.judge(pair.a, pair.b);
  assert.equal(verdict.relation, 'contradicts');
  assert.deepEqual(verdict.trail, { premises: [['הממשלה התחייבה', 'הממשלה התחייבה']], consequences: [['הרכבת נפתחת'], ['הרכבת לא נפתחת']] });
  // Two decompositions; the identical premises are one judged pair (the reverse direction
  // shares the key); the consequences are one judged pair, since a contradiction ends the
  // equivalence check and the contradiction scan finds it cached.
  assert.equal(judge.cost.calls, 2 + 1 + 1);
});

test('the sample set loads, and the lexical baseline runs over it end to end', async () => {
  const pairs = readPairs(SAMPLE_PAIRS);
  assert.equal(pairs.length, 16);
  const report = await compare(pairs, resolveMethods(['lexical']));
  // Fourteen claims all fit inside the deepest cutoff, so recall there can only be full.
  assert.equal(report.retrieval.lexical.recallAt[100], 1);
  // The one-word-apart contradiction (p07) and the wordless paraphrase (p02) are exactly what the baseline cannot see.
  assert.equal(report.judgment.lexical.contradictionRecall, 0);
  assert.ok(report.judgment.lexical.perRelation.equivalent.recall < 1);
  assert.throws(() => resolveMethods(['embedding:bge-m3']), /no adapter for method "embedding:bge-m3"/);
});
