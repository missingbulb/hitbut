// The committed roster, as the Worker sees it. One module does the import so the file's
// location is spelled once, and so a change of form (a bundled JSON, a fetched object)
// touches nothing that reads the roster.
import file from '../../../data/roster.json' with { type: 'json' };
import { readRoster, type Roster } from './roster.ts';

/** Throws at module load if the file is not usable — a half-loaded roster silently stops tracking somebody. */
const roster: Roster = readRoster(file);

/** The public-eye test the roster applies, published on the methodology page. */
export const INCLUSION_RULE = roster.inclusionRule;

export const ROSTER = roster.entries;
