// The corpus entities, as both halves see them. Identifiers here are citations:
// once minted they are never reused, renumbered or deleted, and withdrawal is a
// status rather than a removal.

export type FigureStatus = 'active' | 'retired';

/** Which source reaches a figure, and the earliest date it goes back to. */
export type Coverage = { sourceModule: string; from: string };

export type Figure = {
  /** Slug, minted once when the roster entry is authored; opaque from then on. */
  id: string;
  displayName: string;
  role: string;
  aliases: string[];
  status: FigureStatus;
  /**
   * The written test this person meets, from their roster entry. `null` only for a row
   * that predates the roster — never for somebody we chose to track.
   */
  qualifies: string | null;
  /**
   * What this figure's record actually covers. `null` is not the same as an empty list:
   * unrecorded, versus a person no source reaches. The page says different things.
   */
  coverage: Coverage[] | null;
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

/**
 * How far a source pins a date down. Thirty years back it is often a month and no more,
 * and the difference between "March 1998", "12 March 1998" and "we do not know" is three
 * states, not two — a month recorded as its first day is a fact nobody established.
 */
export const DATE_PRECISIONS = ['day', 'month', 'year'] as const;

export type DatePrecision = (typeof DATE_PRECISIONS)[number];

/** When something was said, and how precisely the source establishes it. */
export type SaidAt = { value: string; precision: DatePrecision } | null;

/**
 * Where an utterance was made. A property of the speech act, not of who reported it.
 *
 * The array is the source and the type is derived from it, because a union of string
 * literals type-strips to nothing and every runtime that needs to validate a venue would
 * otherwise keep its own copy. The migrations' CHECK constraints are the copy that cannot
 * import this one; `dev/gates/sql-vocabularies.test.ts` holds them to it.
 */
export const VENUES = [
  'plenary', 'committee', 'interview', 'press-conference', 'op-ed',
  'broadcast', 'rally', 'party-forum', 'written-statement', 'other',
] as const;

export type Venue = (typeof VENUES)[number];

/** Who it was addressed to. `null` where the source does not establish one. */
export const AUDIENCES = ['general-public', 'parliament', 'party-members', 'foreign-press', 'professional'] as const;

export type Audience = (typeof AUDIENCES)[number] | null;

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

/**
 * An emergent subject. Discovered from where utterances fall in embedding space, not
 * chosen from a vocabulary — a list decided in advance decides in advance what the corpus
 * is allowed to be about. The label is regenerated from the members and is display only.
 */
export type Cluster = {
  id: string;
  /** Null until the cluster has enough members to be worth naming. */
  label: string | null;
  createdAt: string;
};

/** One utterance's place in one cluster, with the distance it joined at. */
export type ClusterMember = {
  clusterId: string;
  utteranceId: string;
  distance: number | null;
  assignedAt: string;
};

/**
 * Where one utterance sits on its cluster's own axis. A separate judgment from the
 * embedding, because distance measures aboutness and not agreement, and only defensible
 * with the model and prompt that produced it attached.
 */
export type Stance = {
  id: string;
  utteranceId: string;
  clusterId: string;
  /** -1..1 along the cluster's axis. */
  position: number;
  /** 0..1. */
  confidence: number;
  modelVersion: string;
  promptVersion: string;
  createdAt: string;
};

/**
 * The two questions a stance series can answer. An anomaly asks who they were talking to;
 * a trend change asks when the position moved.
 */
export type FindingKind = 'anomaly' | 'trend-change';

/** What an utterance is doing in a finding. */
export type FindingRole = 'deviating' | 'before' | 'after';

/** When a trend change happened: the interval the series bounds it to, never a date. */
export type ChangeWindow = { after: string; before: string };

export type Finding = {
  id: string;
  figureId: string;
  clusterId: string;
  kind: FindingKind;
  rationale: string;
  score: number;
  /** Set on an anomaly, null on a trend change. Audience stays null where none is known. */
  venue: Venue | null;
  audience: Audience;
  /** Set on a trend change, null on an anomaly. */
  changed: ChangeWindow | null;
  /** The utterances it rests on, and what each one is doing in it. */
  restsOn: { utteranceId: string; role: FindingRole }[];
  modelVersion: string;
  promptVersion: string;
  createdAt: string;
  supersededBy: string | null;
  surfaced: boolean;
};

/**
 * A passage by somebody we do not track, held under the name the document gave. It is a
 * decision waiting for a person, not a record about a figure — so it has no figure id, no
 * cluster and no stance, and nothing in analysis reads it.
 */
export type Unattributed = {
  id: string;
  sourceId: string;
  /** Exactly as the document wrote it; never normalized towards a roster name. */
  speakerName: string;
  speakerRole: string | null;
  /** Its position in the payload, which is what keeps the resolved statements' ids still. */
  ordinal: number;
  quote: string;
  language: Language;
  saidAt: string | null;
  context: string | null;
  createdAt: string;
};

/** One source module's pass: what it moved, and what it could not. */
export type Run = {
  id: string;
  sourceModule: string;
  startedAt: string;
  finishedAt: string;
  fetched: number;
  cached: number;
  utterances: number;
  unattributed: number;
  failures: { key: string; reason: string }[];
};

/**
 * What the corpus holds. Every field is a count of something committed — nothing here is
 * derived from anybody reading the site.
 */
export type CorpusTotals = {
  figures: number;
  utterances: number;
  attestations: number;
  clusters: number;
  /** Live and surfaced, which is what the site shows; superseded ones are excluded. */
  findings: number;
  unattributed: number;
};

/**
 * A distribution as a list of named buckets. `undated` is its own bucket rather than a
 * missing key, because the number of utterances no source dated is a fact about the
 * corpus worth reading, and folding it into a year would invent one.
 */
export type Distribution = {
  buckets: { name: string; count: number }[];
  undated: number;
};
