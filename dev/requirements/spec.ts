// Reading requirements.md as data: the numbered leaves are the spec's contract with
// the harness, so exactly one parser produces them for the coverage gate, the gallery
// generator and anything else that needs the id set.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REQUIREMENTS_ROOT = fileURLToPath(new URL('.', import.meta.url));
export const SPEC_PATH = fileURLToPath(new URL('./requirements.md', import.meta.url));
const PROVISIONAL_PATH = fileURLToPath(new URL('./provisional.json', import.meta.url));

// A requirement line: a backtick-wrapped dotted number, optionally after a list dash.
// Shared with every other project running this framework — keep it byte-identical.
const REQUIREMENT_LINE = /^\s*(?:-\s+)?`(\d+(?:\.\d+)+)`/;

export type Requirement = {
  id: string;
  /** The one-line statement, without the id. */
  title: string;
  /** Line number in requirements.md, 1-based — for pointing a finding at the source. */
  line: number;
  /** True when no finer-numbered requirement sits under this one. */
  leaf: boolean;
};

/** Numeric, segment by segment: 5.10 sorts after 5.9, which a string compare gets wrong. */
export function compareIds(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? -1) - (right[i] ?? -1);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function parseRequirements(markdown: string): Requirement[] {
  const found: Omit<Requirement, 'leaf'>[] = [];
  markdown.split('\n').forEach((text, index) => {
    const match = REQUIREMENT_LINE.exec(text);
    if (!match) return;
    const title = text.slice(match[0].length).replace(/^[\s—:-]+/, '').trim();
    found.push({ id: match[1], title, line: index + 1 });
  });
  return found.map((requirement) => ({
    ...requirement,
    leaf: !found.some((other) => other.id.startsWith(`${requirement.id}.`)),
  }));
}

export function readRequirements(): Requirement[] {
  return parseRequirements(readFileSync(SPEC_PATH, 'utf8'));
}

export function readLeaves(): Requirement[] {
  return readRequirements().filter((requirement) => requirement.leaf);
}

/**
 * Leaves the coverage gate lets stand unclaimed — the burn-down list, shrunk
 * deliberately. Each entry says why the leaf cannot be asserted yet and what closes it.
 */
export type Provisional = { id: string; why: string; closes: string };

export function readProvisional(): Provisional[] {
  return JSON.parse(readFileSync(PROVISIONAL_PATH, 'utf8')).provisional;
}
