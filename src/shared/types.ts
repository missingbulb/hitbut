// The corpus entities, as both halves see them. Identifiers here are citations:
// once minted they are never reused, renumbered or deleted, and withdrawal is a
// status rather than a removal.

export type FigureStatus = 'active' | 'retired';

export type Figure = {
  /** Slug, minted once at creation from the name of the day; opaque from then on. */
  id: string;
  displayName: string;
  role: string;
  aliases: string[];
  status: FigureStatus;
};

export type SourceKind = 'transcript' | 'press-release' | 'article' | 'broadcast';

/** How a fetched payload ended up, so a source's failure stays legible as a failure. */
export type ExtractionStatus = 'pending' | 'extracted' | 'failed' | 'blocked';

export type Source = {
  id: string;
  url: string;
  publisher: string;
  kind: SourceKind;
  /** When we fetched it — never confused with when the statement was made. */
  fetchedAt: string;
  /** Where the verbatim payload sits in the raw cache. */
  rawKey: string;
  extraction: ExtractionStatus;
};

export type Language = 'he' | 'en';

export type Statement = {
  id: string;
  figureId: string;
  quote: string;
  language: Language;
  /**
   * When it was said. `null` means the source does not establish a date — a distinct
   * state from any date, carried as null the whole way through and omitted (never
   * defaulted) on the wire.
   */
  saidAt: string | null;
  context: string | null;
  sourceId: string;
  topics: string[];
};

/**
 * What the judge said about one pair. Consistent pairs are judgments too: keeping the
 * negatives is what makes the surfacing threshold tunable without re-paying for them.
 */
export type JudgmentKind = 'contradiction' | 'position-shift' | 'consistent';

export type Judgment = {
  id: string;
  figureId: string;
  earlierStatementId: string;
  laterStatementId: string;
  kind: JudgmentKind;
  /** 0–1 confidence that the pair is what `kind` says it is. */
  score: number;
  rationale: string;
  /** The trail: which model, reading which committed prompt, said this. */
  modelVersion: string;
  promptVersion: string;
  createdAt: string;
  /** Set when a later re-analysis replaced this judgment; the record itself stays. */
  supersededBy: string | null;
  /** Whether the product shows it: score over the threshold, kind not `consistent`. */
  surfaced: boolean;
};

export const SURFACED_KINDS: JudgmentKind[] = ['contradiction', 'position-shift'];

/**
 * How far a source pins a date down. Thirty years back it is often a month and no more,
 * and the difference between "March 1998", "12 March 1998" and "we do not know" is three
 * states, not two — a month recorded as its first day is a fact nobody established.
 */
export type DatePrecision = 'day' | 'month' | 'year';

/** When something was said, and how precisely the source establishes it. */
export type SaidAt = { value: string; precision: DatePrecision } | null;

/** Where an utterance was made. A property of the speech act, not of who reported it. */
export type Venue =
  | 'plenary'
  | 'committee'
  | 'interview'
  | 'press-conference'
  | 'op-ed'
  | 'broadcast'
  | 'rally'
  | 'party-forum'
  | 'written-statement'
  | 'other';

/** Who it was addressed to. `null` where the source does not establish one. */
export type Audience = 'general-public' | 'parliament' | 'party-members' | 'foreign-press' | 'professional' | null;

/**
 * One thing said once. Several documents reporting it are several attestations of this
 * one utterance — stored as several records instead, a persona's timeline becomes copies
 * of one sentence and analysis reads the echo as agreement.
 */
export type Utterance = {
  id: string;
  figureId: string;
  /** The fullest wording any attestation carries. */
  text: string;
  language: Language;
  saidAt: SaidAt;
  venue: Venue;
  audience: Audience;
  createdAt: string;
};

/** One document reporting an utterance. */
export type Attestation = {
  id: string;
  utteranceId: string;
  sourceId: string;
  /** The text as this document renders it, even where the utterance holds a fuller one. */
  text: string;
  /** When the document was published — never when the words were said. */
  publishedAt: string | null;
  createdAt: string;
};
