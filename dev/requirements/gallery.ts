// The spec doubles as a gallery of what the product actually shows: under every visual
// leaf, the committed screenshot that is that leaf's expected result. Approving the
// requirements document is then approving the product's appearance.
//
// The image lines are machine-managed. Regenerate them; never type one.
import { readFileSync } from 'node:fs';
import { readLeaves, SPEC_PATH, type Requirement } from './spec.ts';
import { KINDS, readCases, type CaseFile } from './registry.ts';

const open = (id: string) => `<!-- gallery:${id} -->`;
const close = (id: string) => `<!-- /gallery:${id} -->`;

/** The lines that belong between a leaf's markers. */
function galleryLines(leaf: Requirement, cases: CaseFile[]): string[] {
  const claimed = cases.find((caseFile) => caseFile.id === leaf.id);
  if (!claimed?.golden) return [];
  return ['', `![${leaf.id} — ${leaf.title}](${claimed.kind}/cases/${claimed.golden})`, ''];
}

/** The spec with every gallery block rewritten from what is on disk. */
export function renderGallery(markdown: string): string {
  const visualKinds = KINDS.filter((kind) => kind.visual).map((kind) => kind.name);
  const cases = visualKinds.flatMap((kind) => readCases(kind));
  let rendered = markdown;

  for (const leaf of readLeaves()) {
    const start = rendered.indexOf(open(leaf.id));
    if (start === -1) continue;
    const end = rendered.indexOf(close(leaf.id), start);
    if (end === -1) throw new Error(`requirements.md: ${open(leaf.id)} has no closing marker`);
    const before = rendered.slice(0, start + open(leaf.id).length);
    const after = rendered.slice(end);
    rendered = `${before}\n${galleryLines(leaf, cases).join('\n')}\n${after}`;
  }
  return rendered;
}

/** Which leaves are missing a gallery block they should have, and which have a spare one. */
export function markerProblems(markdown: string): string[] {
  const problems: string[] = [];
  const visual = new Set(
    KINDS.filter((kind) => kind.visual)
      .flatMap((kind) => readCases(kind.name))
      .map((caseFile) => caseFile.id),
  );
  for (const id of visual) {
    if (!markdown.includes(open(id))) problems.push(`${id} is proven by a screenshot but has no ${open(id)} block`);
  }
  for (const match of markdown.matchAll(/<!-- gallery:([\d.]+) -->/g)) {
    if (!visual.has(match[1])) problems.push(`${open(match[1])} names a leaf no visual case claims`);
  }
  return problems.sort();
}

export const readSpec = (): string => readFileSync(SPEC_PATH, 'utf8');
