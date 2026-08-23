// Who we track, and why. The roster is an **input** to acquisition, never an output of
// it: a name a document happens to contain must not be able to create a tracked figure
// (#31). Adding a person is a reviewed change to the committed file this module reads.
//
// Ids are committed rather than minted, because the id is the citation and the decision to
// track someone is exactly the moment it should be fixed. Minting from the display name
// would mean a rename in this file minted a second figure — the failure `1.1` exists to
// prevent.
import type { Coverage, Figure } from '../../shared/types.ts';

export type RosterEntry = {
  /** The slug, authored once with the entry; opaque from then on. */
  id: string;
  displayName: string;
  role: string;
  aliases: string[];
  /**
   * The written test this person meets. For an elected official it is a formality; for a
   * commentator it is the whole of the defensibility, which is why it is required rather
   * than encouraged.
   */
  qualifies: string;
  /** Which source modules cover this person, and the earliest date each one reaches. */
  coverage: Coverage[];
  status: Figure['status'];
};

const SLUG = /^[^\s/?#]+$/u;

/** Why an entry is not usable, in the words the reviewer needs. Empty means it is. */
export function faultsIn(entry: Partial<RosterEntry>, index: number): string[] {
  const at = `roster entry ${index}${entry.displayName ? ` (${entry.displayName})` : ''}`;
  const faults: string[] = [];
  if (!entry.id || !SLUG.test(entry.id)) faults.push(`${at}: id must be a slug with no whitespace or URL punctuation`);
  if (!entry.displayName?.trim()) faults.push(`${at}: displayName is required`);
  if (!entry.role?.trim()) faults.push(`${at}: role is required`);
  if (!entry.qualifies?.trim()) {
    faults.push(`${at}: qualifies is required — say what put this person on the roster, or take them off it`);
  }
  if (!Array.isArray(entry.coverage) || entry.coverage.length === 0) {
    faults.push(`${at}: coverage is required — a page that cannot say what it covers cannot say what it omits`);
  }
  if (entry.status !== 'active' && entry.status !== 'retired') faults.push(`${at}: status must be active or retired`);
  return faults;
}

/** The public-eye test the roster applies, and the people it admits. */
export type Roster = {
  /** Written once, applied to everybody. Published on the methodology page. */
  inclusionRule: string;
  entries: RosterEntry[];
};

/**
 * Validates a whole roster, refusing the file rather than the bad entry — a roster half
 * loaded is a roster that silently stops tracking somebody.
 *
 * The file is an object rather than a bare array so it can carry its own warning to whoever
 * opens it, and so the test can live beside the people it admits; JSON has nowhere else to
 * put either.
 */
export function readRoster(file: unknown): Roster {
  const raw = (file as { entries?: unknown })?.entries;
  if (!Array.isArray(raw)) throw new Error('the roster file must be an object with an "entries" array');

  const rule = (file as { inclusionRule?: unknown })?.inclusionRule;
  const faults = typeof rule === 'string' && rule.trim()
    ? []
    // The test is what makes the roster a rule rather than a list of people somebody
    // decided to scrutinise, so its absence is not a warning, it is a refusal.
    : ['the roster states no inclusionRule — write the public-eye test it applies, once, for everybody'];

  faults.push(...raw.flatMap((entry, index) => faultsIn(entry as Partial<RosterEntry>, index)));
  const ids = raw.map((entry) => (entry as RosterEntry).id);
  const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
  for (const id of new Set(duplicated)) faults.push(`roster id "${id}" appears more than once`);

  if (faults.length) throw new Error(`the roster is not usable:\n  ${faults.join('\n  ')}`);
  return { inclusionRule: rule as string, entries: raw as RosterEntry[] };
}

/** Every name this entry can be recognised by, folded for comparison by the caller. */
export const namesOf = (entry: RosterEntry): string[] => [entry.displayName, ...entry.aliases];
