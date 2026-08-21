// The shapes that cross the HTTP boundary. The site imports these and nothing else from
// the back end's side of the fence.
import type { Figure, Judgment, Source, Statement } from './types.ts';

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
  statementCount: number;
  /** Surfaced judgments involving this figure. */
  flaggedCount: number;
  topics: string[];
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
