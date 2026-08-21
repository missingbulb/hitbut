// The sample corpus every kind runs against.
//
// EVERY FIGURE, QUOTE, DATE, SOURCE AND COUNT HERE IS INVENTED. Nothing in this file
// attributes a statement to a real person, and the publishers are named "לדוגמה" (sample)
// so a committed screenshot cannot be mistaken for a record of anything real.
//
// Determinism is the other job: one reference instant, a seeded id minter, no wall clock —
// so the ids in a golden image are the same ids on every machine, forever.
import { Corpus } from '../../../src/backend/corpus/store.ts';
import { createUlidFactory } from '../../../src/backend/corpus/ids.ts';
import type { D1Database } from '../../../src/backend/env.ts';
import type { SourceModule } from '../../../src/backend/acquisition/registry.ts';
import { migratedDatabase } from './local-d1.ts';

/** The one instant everything that formats or compares a date is measured against. */
export const REFERENCE_NOW = '2026-06-15T09:00:00.000Z';

/** A tiny seeded PRNG: the same sequence on every machine, unlike Math.random. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A ULID minter with a fixed clock and fixed randomness. */
export function deterministicIds(startMs = Date.parse('2026-06-14T00:00:00.000Z')): ReturnType<typeof createUlidFactory> {
  let tick = 0;
  return createUlidFactory({ now: () => startMs + tick++ * 1000, random: seededRandom(20260614) });
}

/** A clock for `created_at` that moves a minute at a time, so order is legible in the data. */
export function deterministicClock(start = REFERENCE_NOW): () => string {
  let tick = 0;
  return () => new Date(Date.parse(start) + tick++ * 60_000).toISOString();
}

export function corpusOn(db: D1Database): Corpus {
  return new Corpus(db, { ulid: deterministicIds(), now: deterministicClock() });
}

/** An empty, migrated corpus in memory — what a logic or behavior case starts from. */
export function emptyCorpus(): Corpus {
  return corpusOn(migratedDatabase());
}

const PUBLISHERS = {
  protocols: 'ארכיון פרוטוקולים לדוגמה',
  paper: 'העיתון לדוגמה',
  channel: 'ערוץ החדשות לדוגמה',
  review: 'The Sample Review',
};

export type SeededCorpus = {
  corpus: Corpus;
  figures: { ilana: string; doron: string; neta: string };
  statements: {
    lightRailPledge: string;
    lightRailDenial: string;
    lightRailFollowUp: string;
    undatedCommittee: string;
    housingBudget: string;
    housingPermits: string;
    knessetBudgetDelay: string;
    budgetCommitment: string;
    budgetDenial: string;
  };
  judgments: { lightRailOld: string; lightRail: string; housing: string; budget: string; consistent: string };
};

/**
 * Writes the sample corpus through the shipped store, so what the harness reads back is
 * whatever the product's own writes actually produce.
 */
export async function seedCorpus(corpus: Corpus): Promise<SeededCorpus> {
  const ilana = await corpus.ensureFigure({ displayName: 'אילנה מורג־עציון', role: 'חברת הכנסת (דמות לדוגמה)' });
  const doron = await corpus.ensureFigure({ displayName: 'דורון בן־שחר', role: 'פרשן כלכלי (דמות לדוגמה)' });
  const neta = await corpus.ensureFigure({ displayName: 'נטע קרליבך', role: 'עיתונאית (דמות לדוגמה)' });

  const protocol = await corpus.recordSource({
    url: 'https://example.org/protocols/2024-03-12',
    publisher: PUBLISHERS.protocols, kind: 'transcript', fetchedAt: REFERENCE_NOW,
    rawKey: 'sample/protocol-2024-03-12.raw', extraction: 'extracted',
    sourceModule: 'sample-protocols', externalKey: 'protocol-2024-03-12',
  });
  const undated = await corpus.recordSource({
    url: 'https://example.org/protocols/archive-041',
    publisher: PUBLISHERS.protocols, kind: 'transcript', fetchedAt: REFERENCE_NOW,
    rawKey: 'sample/archive-041.raw', extraction: 'extracted',
    sourceModule: 'sample-protocols', externalKey: 'archive-041',
  });
  const presser = await corpus.recordSource({
    url: 'https://example.org/press/2026-06-03',
    publisher: PUBLISHERS.channel, kind: 'broadcast', fetchedAt: REFERENCE_NOW,
    rawKey: 'sample/press-2026-06-03.raw', extraction: 'extracted',
    sourceModule: 'sample-press', externalKey: 'press-2026-06-03',
  });
  const column2025 = await corpus.recordSource({
    url: 'https://example.org/columns/2025-01-20',
    publisher: PUBLISHERS.paper, kind: 'article', fetchedAt: REFERENCE_NOW,
    rawKey: 'sample/column-2025-01-20.raw', extraction: 'extracted',
    sourceModule: 'sample-paper', externalKey: 'column-2025-01-20',
  });
  const column2026 = await corpus.recordSource({
    url: 'https://example.org/columns/2026-02-11',
    publisher: PUBLISHERS.paper, kind: 'article', fetchedAt: REFERENCE_NOW,
    rawKey: 'sample/column-2026-02-11.raw', extraction: 'extracted',
    sourceModule: 'sample-paper', externalKey: 'column-2026-02-11',
  });
  const newsroom = await corpus.recordSource({
    url: 'https://example.org/columns/2026-05-01',
    publisher: PUBLISHERS.paper, kind: 'article', fetchedAt: REFERENCE_NOW,
    rawKey: 'sample/column-2026-05-01.raw', extraction: 'extracted',
    sourceModule: 'sample-paper', externalKey: 'column-2026-05-01',
  });
  const englishBrief = await corpus.recordSource({
    url: 'https://example.org/review/2025-11-05',
    publisher: PUBLISHERS.review, kind: 'article', fetchedAt: REFERENCE_NOW,
    rawKey: 'sample/review-2025-11-05.raw', extraction: 'extracted',
    sourceModule: 'sample-review', externalKey: 'review-2025-11-05',
  });
  const englishFollowUp = await corpus.recordSource({
    url: 'https://example.org/review/2026-04-02',
    publisher: PUBLISHERS.review, kind: 'article', fetchedAt: REFERENCE_NOW,
    rawKey: 'sample/review-2026-04-02.raw', extraction: 'extracted',
    sourceModule: 'sample-review', externalKey: 'review-2026-04-02',
  });

  const [pledge] = await corpus.saveStatements(protocol.id, [{
    ordinal: 0, figureId: ilana.id, language: 'he', saidAt: '2024-03-12',
    quote: 'לא אצביע בעד תקציב שגורע ולו שקל אחד מהרכבת הקלה.',
    context: 'דיון במליאה על הצעת התקציב לשנת 2024.',
    topics: ['רכבת קלה', 'תקציב'],
  }]);
  const [undatedCommittee] = await corpus.saveStatements(undated.id, [{
    // The archive page carries no date at all, so the corpus stores none.
    ordinal: 0, figureId: ilana.id, language: 'he', saidAt: null,
    quote: 'דיברנו כאן על תחבורה ציבורית לא פעם, ואין על כך מחלוקת.',
    context: 'עמוד ארכיון ללא תאריך מתועד.',
    topics: ['תחבורה'],
  }]);
  const [denial, followUp] = await corpus.saveStatements(presser.id, [
    {
      ordinal: 0, figureId: ilana.id, language: 'he', saidAt: '2026-06-03',
      quote: 'הקו הזה מעולם לא היה בראש סדר העדיפויות שלי — המספרים פשוט לא עובדים.',
      context: 'מסיבת עיתונאים לאחר ישיבת הוועדה.',
      topics: ['רכבת קלה'],
    },
    {
      ordinal: 1, figureId: ilana.id, language: 'he', saidAt: '2026-06-03',
      quote: 'נמשיך לעקוב אחרי לוחות הזמנים של הפרויקט.',
      context: 'מסיבת עיתונאים לאחר ישיבת הוועדה.',
      topics: ['רכבת קלה'],
    },
  ]);
  const [housingBudget] = await corpus.saveStatements(column2025.id, [{
    ordinal: 0, figureId: ilana.id, language: 'he', saidAt: '2025-01-20',
    quote: 'מצוקת הדיור היא בעיה תקציבית. בלי תקציב ייעודי לא נפתור אותה.',
    context: 'טור אורח.', topics: ['דיור', 'תקציב'],
  }]);
  const [housingPermits] = await corpus.saveStatements(column2026.id, [{
    ordinal: 0, figureId: ilana.id, language: 'he', saidAt: '2026-02-11',
    quote: 'מצוקת הדיור היא בעיית היתרי בנייה. שיניתי את דעתי מאז 2025.',
    context: 'טור אורח.', topics: ['דיור'],
  }]);
  const [knessetBudgetDelay] = await corpus.saveStatements(newsroom.id, [{
    ordinal: 0, figureId: neta.id, language: 'he', saidAt: '2026-05-01',
    quote: 'הדיון בכנסת על התקציב נדחה שוב, וזה כבר לא מקרי.',
    context: 'טור שבועי.', topics: ['תקציב', 'כנסת'],
  }]);
  const [budgetCommitment] = await corpus.saveStatements(englishBrief.id, [{
    ordinal: 0, figureId: doron.id, language: 'en', saidAt: '2025-11-05',
    quote: 'We committed to a dedicated budget line for the programme, and that commitment stands.',
    context: 'Opinion column.', topics: ['budget'],
  }]);
  const [budgetDenial] = await corpus.saveStatements(englishFollowUp.id, [{
    ordinal: 0, figureId: doron.id, language: 'en', saidAt: '2026-04-02',
    quote: 'Nobody ever promised a dedicated budget line. That is a misreading of the record.',
    context: 'Opinion column.', topics: ['budget'],
  }]);

  const threshold = 0.7;
  const consistent = await corpus.recordJudgment({
    figureId: ilana.id, earlierStatementId: pledge.id, laterStatementId: followUp.id,
    kind: 'consistent', score: 0.21,
    rationale: 'שתי האמירות יכולות להתקיים יחד: התחייבות תקציבית ומעקב אחרי לוחות זמנים.',
    modelVersion: 'sample/judge-1', promptVersion: 'inconsistency/v1',
  }, threshold);
  const budget = await corpus.recordJudgment({
    figureId: doron.id, earlierStatementId: budgetCommitment.id, laterStatementId: budgetDenial.id,
    kind: 'contradiction', score: 0.88,
    rationale: 'The earlier column states a commitment to a dedicated budget line; the later one denies any such promise was made.',
    modelVersion: 'sample/judge-1', promptVersion: 'inconsistency/v1',
  }, threshold);
  const housing = await corpus.recordJudgment({
    figureId: ilana.id, earlierStatementId: housingBudget.id, laterStatementId: housingPermits.id,
    kind: 'position-shift', score: 0.83,
    rationale: 'המסגור עבר מבעיה תקציבית לבעיית היתרי בנייה, והדוברת אומרת זאת במפורש.',
    modelVersion: 'sample/judge-1', promptVersion: 'inconsistency/v1',
  }, threshold);
  // Judged once by an older model, then re-judged: the first record stays, superseded.
  const lightRailOld = await corpus.recordJudgment({
    figureId: ilana.id, earlierStatementId: pledge.id, laterStatementId: denial.id,
    kind: 'contradiction', score: 0.71,
    rationale: 'שתי האמירות אינן מתיישבות זו עם זו.',
    modelVersion: 'sample/judge-0', promptVersion: 'inconsistency/v1',
  }, threshold);
  const lightRail = await corpus.recordJudgment({
    figureId: ilana.id, earlierStatementId: pledge.id, laterStatementId: denial.id,
    kind: 'contradiction', score: 0.94,
    rationale: 'ב־2024 נאמרה התחייבות תקציבית בלתי מסויגת, וב־2026 נאמר שהעמדה הזו מעולם לא הייתה קיימת.',
    modelVersion: 'sample/judge-1', promptVersion: 'inconsistency/v1',
  }, threshold);

  return {
    corpus,
    figures: { ilana: ilana.id, doron: doron.id, neta: neta.id },
    statements: {
      lightRailPledge: pledge.id, lightRailDenial: denial.id, lightRailFollowUp: followUp.id,
      undatedCommittee: undatedCommittee.id, housingBudget: housingBudget.id,
      housingPermits: housingPermits.id, knessetBudgetDelay: knessetBudgetDelay.id,
      budgetCommitment: budgetCommitment.id, budgetDenial: budgetDenial.id,
    },
    judgments: {
      lightRailOld: lightRailOld.id, lightRail: lightRail.id, housing: housing.id,
      budget: budget.id, consistent: consistent.id,
    },
  };
}

/**
 * One statement in an otherwise empty corpus, for a case that cares about a single
 * quote — a search fold, a null date — and not about the whole sample world.
 */
export async function withStatement(
  corpus: Corpus,
  quote: string,
  extras: { saidAt?: string | null; language?: 'he' | 'en'; topics?: string[]; speaker?: string; ordinal?: number } = {},
) {
  const figure = await corpus.ensureFigure({ displayName: extras.speaker ?? 'דמות לדוגמה', role: 'דמות לדוגמה' });
  const source = await corpus.recordSource({
    url: `https://example.org/sample/${encodeURIComponent(quote.slice(0, 12))}`,
    publisher: PUBLISHERS.protocols, kind: 'transcript', fetchedAt: REFERENCE_NOW,
    rawKey: 'sample/one-statement.raw', extraction: 'extracted',
    sourceModule: 'sample-protocols', externalKey: quote.slice(0, 24),
  });
  const [statement] = await corpus.saveStatements(source.id, [{
    ordinal: extras.ordinal ?? 0,
    figureId: figure.id,
    quote,
    language: extras.language ?? 'he',
    saidAt: extras.saidAt === undefined ? '2026-01-01' : extras.saidAt,
    context: null,
    topics: extras.topics ?? [],
  }]);
  return { figure, source, statement };
}

/** Two statements by one figure on one topic — the shape analysis is built to compare. */
export async function withPair(corpus: Corpus, earlierQuote: string, laterQuote: string, topic = 'תקציב') {
  const speaker = 'דמות לדוגמה';
  const earlier = await withStatement(corpus, earlierQuote, { speaker, topics: [topic], saidAt: '2025-01-10' });
  const later = await withStatement(corpus, laterQuote, { speaker, topics: [topic], saidAt: '2026-01-10' });
  return { figure: earlier.figure, earlier: earlier.statement, later: later.statement };
}

/** A migrated, seeded corpus in memory. */
export async function seededCorpus(): Promise<SeededCorpus> {
  return seedCorpus(emptyCorpus());
}

/**
 * A source module built from payloads the case supplies. Acquisition's machinery is real;
 * the site it reads is not, because inventing a sample of a real site would prove support
 * for a target the world does not serve (#28).
 */
export function fixtureSource(options: {
  id?: string;
  documents: { key: string; url: string; payload: string }[];
  extract?: SourceModule['extract'];
  onExtract?: (key: string) => void;
}): SourceModule & { payloads: Map<string, string> } {
  const payloads = new Map(options.documents.map((document) => [document.url, document.payload]));
  return {
    id: options.id ?? 'fixture-source',
    publisher: PUBLISHERS.protocols,
    kind: 'transcript',
    surface: 'markup',
    refreshMinutes: 180,
    payloads,
    list: async () => options.documents.map(({ key, url }) => ({ key, url })),
    extract: (payload, document) => {
      options.onExtract?.(document.key);
      if (options.extract) return options.extract(payload, document);
      // The fixture payload is one quote per line: `speaker|date|topics|quote`, with an
      // empty date meaning the document does not establish one.
      return payload
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, ordinal) => {
          const [speaker, date, topics, quote] = line.split('|');
          return {
            ordinal,
            speaker: { displayName: speaker, role: 'דמות לדוגמה' },
            quote,
            language: 'he' as const,
            saidAt: date === '' ? null : date,
            context: null,
            topics: topics ? topics.split(',') : [],
          };
        });
    },
  };
}
