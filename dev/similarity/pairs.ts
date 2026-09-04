// The labelled pair set the comparison is judged on: what one record is, and how a file of
// them is read. The set is the owner's expectation of what "equivalent", "contradicts" and
// the rest mean on this corpus — every metric in the report is relative to it, so a record
// that does not say exactly what it claims is refused at the door rather than scored.
import { readFileSync } from 'node:fs';

export const RELATIONS = ['equivalent', 'entails', 'contradicts', 'same-subject', 'unrelated'] as const;
export type Relation = (typeof RELATIONS)[number];

/**
 * The relations under which two claims are logical partners — what retrieval has to put
 * in front of a judge. Same-subject and unrelated pairs are what it must keep apart.
 */
export const LOGICAL: readonly Relation[] = ['equivalent', 'entails', 'contradicts'];

/**
 * The unit of comparison: one self-contained declarative sentence, keyed on the utterance
 * it was taken from so a match stays a trail into the record rather than a claim on its own.
 */
export type Claim = { id: string; utteranceId: string; text: string };

export type LabelledPair = {
  id: string;
  a: Claim;
  b: Claim;
  relation: Relation;
  /** What the second annotator said when they disagreed. Absent when both agreed. */
  disagreement?: Relation;
  note?: string;
};

const isRelation = (value: unknown): value is Relation => (RELATIONS as readonly unknown[]).includes(value);

const isClaim = (value: unknown): value is Claim =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Claim).id === 'string' &&
  typeof (value as Claim).utteranceId === 'string' &&
  typeof (value as Claim).text === 'string' &&
  (value as Claim).text.trim().length > 0;

/** One JSON record per line. Every problem names the line, because a set is edited by hand. */
export function parsePairs(source: string, where = 'pairs'): LabelledPair[] {
  const pairs: LabelledPair[] = [];
  const seen = new Set<string>();
  source.split('\n').forEach((line, index) => {
    if (!line.trim()) return;
    const at = `${where}:${index + 1}`;
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`${at}: not JSON — ${String(error)}`);
    }
    const pair = record as Partial<LabelledPair>;
    if (typeof pair.id !== 'string' || !pair.id) throw new Error(`${at}: a pair needs an id`);
    if (seen.has(pair.id)) throw new Error(`${at}: pair id ${pair.id} appears twice`);
    if (!isClaim(pair.a) || !isClaim(pair.b)) throw new Error(`${at}: a and b must each be { id, utteranceId, text }`);
    if (pair.a.id === pair.b.id) throw new Error(`${at}: a pair compares two different claims`);
    if (!isRelation(pair.relation)) throw new Error(`${at}: relation must be one of ${RELATIONS.join(', ')}`);
    if (pair.disagreement !== undefined && !isRelation(pair.disagreement)) {
      throw new Error(`${at}: disagreement must be one of ${RELATIONS.join(', ')}`);
    }
    seen.add(pair.id);
    pairs.push({
      id: pair.id,
      a: pair.a,
      b: pair.b,
      relation: pair.relation,
      ...(pair.disagreement !== undefined ? { disagreement: pair.disagreement } : {}),
      ...(typeof pair.note === 'string' ? { note: pair.note } : {}),
    });
  });
  return pairs;
}

export const readPairs = (path: string): LabelledPair[] => parsePairs(readFileSync(path, 'utf8'), path);

/**
 * Every distinct claim the set mentions, in id order. A claim id carrying two different
 * texts is a set that contradicts itself, and is refused.
 */
export function claimsOf(pairs: LabelledPair[]): Claim[] {
  const claims = new Map<string, Claim>();
  for (const pair of pairs) {
    for (const claim of [pair.a, pair.b]) {
      const held = claims.get(claim.id);
      if (held && held.text !== claim.text) {
        throw new Error(`claim ${claim.id} has two texts: "${held.text}" and "${claim.text}"`);
      }
      claims.set(claim.id, claim);
    }
  }
  return [...claims.values()].sort((x, y) => x.id.localeCompare(y.id));
}

/** The relation a pair set gives two claims, whichever way round they were listed. */
export function relationBetween(pairs: LabelledPair[], a: string, b: string): Relation | null {
  const found = pairs.find((pair) => (pair.a.id === a && pair.b.id === b) || (pair.a.id === b && pair.b.id === a));
  return found?.relation ?? null;
}
