// The shapes that cross the HTTP boundary. The site imports these and nothing else from
// the back end's side of the fence.
import type {
  Attestation,
  CorpusTotals,
  Distribution,
  Figure,
  Finding,
  Run,
  SaidAt,
  Source,
  Utterance,
} from './types.ts';

export const API_BASE = '/api/v1';

export type ErrorBody = { error: { code: string; message: string } };

export type Page<T> = { items: T[]; nextCursor: string | null };

/**
 * The roster as a reader sees it: the test, and who it admits. Both in one response because
 * a page that renders half of them says the wrong thing either way — the test alone reads
 * as a policy nobody applied, the people alone as a list somebody chose.
 */
export type RosterView = {
  inclusionRule: string;
  figures: FigureSummary[];
};

export type FigureSummary = Figure & {
  utteranceCount: number;
  /** Utterances a live surfaced finding rests on. */
  flaggedCount: number;
  /**
   * The subjects this persona's utterances fall into. A label is regenerated from a
   * subject's members and is null until there are enough to name it — so an unlabelled
   * subject is shown as nothing rather than as a placeholder pretending to be a topic.
   */
  subjects: { id: string; label: string | null }[];
};


/**
 * An utterance on the wire. `saidAt` is *absent* when no source establishes a date, and
 * carries its own precision when one does: "March 1998" is a month, and rendering it as a
 * day would invent a fact a timeline then sorts by.
 */
export type WireUtterance = Omit<Utterance, 'saidAt'> & { saidAt?: NonNullable<SaidAt> };

export function toWireUtterance(utterance: Utterance): WireUtterance {
  const { saidAt, ...rest } = utterance;
  return saidAt === null ? rest : { ...rest, saidAt };
}

/** One document reporting an utterance, with the source it is. */
export type WireAttestation = { attestation: Attestation; source: Source };

export type UtteranceDetail = {
  utterance: WireUtterance;
  figure: Figure;
  /** Every document that reported it — several outlets carrying one speech is the normal case. */
  attestations: WireAttestation[];
  /** The subject it was assigned to, when it has been through the chain. */
  subject: { id: string; label: string | null } | null;
};

export type UtteranceTimelineEntry = {
  utterance: WireUtterance;
  /**
   * Every publication that carried it, named. A quote with no visible publisher is our word
   * for what somebody said, and which outlets carried something is part of the record.
   */
  publishers: string[];
  /** Whether a live surfaced finding rests on it. */
  flagged: boolean;
};

export type FigureRecord = {
  figure: FigureSummary;
  timeline: UtteranceTimelineEntry[];
};

/** What a finding rests on, resolved for a reader. */
export type FindingUtterance = {
  utterance: WireUtterance;
  role: Finding['restsOn'][number]['role'];
  attestations: WireAttestation[];
};

export type FindingSummary = {
  finding: Finding;
  figure: Figure;
  restsOn: FindingUtterance[];
};

export type FindingDetail = FindingSummary & {
  /** Set when a later analysis replaced it: the id that did, and when. */
  supersededBy: { id: string; createdAt: string } | null;
};

export type UtteranceHit = {
  utterance: WireUtterance;
  figure: Figure;
  publishers: string[];
};

export type UtteranceSearchResults = { query: string; hits: UtteranceHit[]; nextCursor: string | null };

/**
 * What `GET /status` answers: the size and shape of the corpus, and when it was read.
 * Public — every number here is reachable by walking the corpus API, so a credential
 * would protect nothing and would stop a researcher citing the size of what they cite.
 */
export type StatusView = {
  readAt: string;
  totals: CorpusTotals;
  distributions: { venue: Distribution; year: Distribution };
};

/**
 * One source module as the operator sees it. `lastRun` is null for a module that has
 * never run — which is not the same as a module that ran and moved nothing, and the
 * difference is most of why anybody opens this page.
 */
export type ModuleState = {
  id: string;
  publisher: string;
  /** How often this source is meant to be revisited, in minutes. */
  refreshMinutes: number;
  lastRun: Run | null;
};

/** What `GET /operations` answers. Credentialled: failure reasons name internals. */
export type OperationsView = {
  readAt: string;
  modules: ModuleState[];
};
