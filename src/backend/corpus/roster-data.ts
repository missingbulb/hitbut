// The committed roster, as the Worker sees it. One module does the import so the file's
// location is spelled once, and so a change of form (a bundled JSON, a fetched object)
// touches nothing that reads the roster.
import file from '../../../data/roster.json' with { type: 'json' };
import { readRoster, type RosterEntry } from './roster.ts';

/** Throws at module load if the file is not usable — a half-loaded roster silently stops tracking somebody. */
export const ROSTER: RosterEntry[] = readRoster(file);
