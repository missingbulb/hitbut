// The shapes that cross the HTTP boundary. The site imports these and nothing else from
// the back end's side of the fence.
import type { Attestation, Figure, Finding, Judgment, SaidAt, Source, Statement, Utterance } from './types.ts';

export const API_BASE = '/api/v1';

export type ErrorBody = { error: { code: string; message: string } };

export type Page<T> = { items: T[]; nextCursor: string | null };

/**
 * A statement on the wire. `saidAt` is *absent* when the source does not establish a
 * date — the key is omitted rather than sent as null or as a stand-in date, so a
 * consumer cannot mistake "we do not know" for a date we are confident about.
 */
export type WireStatement = Omit<Statement, 'saidAt'> & { saidAt?: string };

export function toWireStatement(statement: Statement): WireStatement {
  const { saidAt, ...rest } = statement;
  return saidAt === null ? rest : { ...rest, saidAt };
}

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

export type TimelineEntry = {
  statement: WireStatement;
  source: Source;
  /** Whether a surfaced judgment names this statement — the site marks these. */
  flagged: boolean;
};

export type FigureDetail = {
  figure: FigureSummary;
  timeline: TimelineEntry[];
};

export type StatementDetail = {
  statement: WireStatement;
  source: Source;
  figure: Figure;
};

export type InconsistencySummary = {
  judgment: Judgment;
  figure: Figure;
  earlier: WireStatement;
  later: WireStatement;
};

export type InconsistencyDetail = InconsistencySummary & {
  earlierSource: Source;
  laterSource: Source;
  /** Set when this judgment was replaced: the id that replaced it, and when. */
  supersededBy: { id: string; createdAt: string } | null;
};

export type SearchHit = {
  statement: WireStatement;
  source: Source;
  figure: Figure;
};

export type SearchResults = {
  query: string;
  hits: SearchHit[];
  nextCursor: string | null;
};

// ---- the utterance surface -------------------------------------------------------------
//
// The shapes the API serves now. `statements` is still written and its types are still
// here, because the reader moved and the writer has not — that is the middle step of the
// schema discipline in #37, and the pair goes when the contract step lands.

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
  /** How many documents reported it. The site shows the count and links to the utterance. */
  attestationCount: number;
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
  attestationCount: number;
};

export type UtteranceSearchResults = { query: string; hits: UtteranceHit[]; nextCursor: string | null };
