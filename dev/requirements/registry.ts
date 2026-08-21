// The kinds and the cases on disk. Every gate rule iterates this registry, so adding a
// kind is a drop-in: declare it here, create its folder, and the gate, the runners and
// the gallery pick it up without an edit.
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { REQUIREMENTS_ROOT } from './spec.ts';

/**
 * A kind is one way a requirement can be asserted. Route a leaf to the kind that can
 * actually observe what it claims — an image cannot see a retry policy, and an
 * assertion about a DOM node cannot see whether a page looks right.
 */
export type Kind = {
  name: string;
  what: string;
  /** Whether a committed image is this kind's expected result. */
  visual: boolean;
};

export const KINDS: Kind[] = [
  { name: 'logic', what: 'a pure product rule, asserted against the shipped code directly', visual: false },
  { name: 'behavior', what: 'a driven action and its consequence, asserted against the fakes’ recordings', visual: false },
  { name: 'server', what: 'a rule the HTTP boundary enforces, asserted against the real Worker', visual: false },
  { name: 'screen', what: 'a rendered page, pixel-exact against a committed screenshot the owner approves', visual: true },
];

export const kind = (name: string): Kind | undefined => KINDS.find((k) => k.name === name);

const CASE_FILE = /^(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)\.(?<id>\d+(?:\.\d+)+)\.case\.ts$/;

export type CaseFile = {
  kind: string;
  /** Stable feature slug — retitling a spec section never forces a rename. */
  slug: string;
  /** The leaf this case claims. */
  id: string;
  file: string;
  /** Absolute path, for importing. */
  absolute: string;
  /** The committed screenshot this case is compared against (visual kinds only). */
  golden?: string;
};

const casesDir = (kindName: string) => path.join(REQUIREMENTS_ROOT, kindName, 'cases');

/** Kind folders actually present on disk, whether or not the registry declares them. */
export function kindDirsOnDisk(): string[] {
  return readdirSync(REQUIREMENTS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(REQUIREMENTS_ROOT, entry.name, 'cases')))
    .map((entry) => entry.name)
    .sort();
}

/** Everything in a kind's cases folder, split into cases, goldens, and anything else. */
export function readKindDir(kindName: string): { cases: CaseFile[]; goldens: string[]; unrecognised: string[] } {
  const dir = casesDir(kindName);
  const cases: CaseFile[] = [];
  const goldens: string[] = [];
  const unrecognised: string[] = [];
  if (!existsSync(dir)) return { cases, goldens, unrecognised };
  for (const file of readdirSync(dir).sort()) {
    const match = CASE_FILE.exec(file);
    if (match) {
      const { slug, id } = match.groups as { slug: string; id: string };
      cases.push({
        kind: kindName,
        slug,
        id,
        file,
        absolute: path.join(dir, file),
        golden: kind(kindName)?.visual ? `${slug}.${id}.png` : undefined,
      });
    } else if (file.endsWith('.png')) {
      goldens.push(file);
    } else {
      unrecognised.push(file);
    }
  }
  return { cases, goldens, unrecognised };
}

export function readCases(kindName?: string): CaseFile[] {
  const names = kindName ? [kindName] : KINDS.map((k) => k.name);
  return names.flatMap((name) => readKindDir(name).cases);
}

export function goldenPath(caseFile: CaseFile): string {
  return path.join(casesDir(caseFile.kind), caseFile.golden!);
}

/**
 * What a case module exports: a title for the test report and the body that drives the
 * product. The context is the kind's — its runner builds one per case.
 */
export type Case<Context = unknown> = {
  title: string;
  run(context: Context): void | Promise<void>;
};

export async function loadCase<Context>(caseFile: CaseFile): Promise<Case<Context>> {
  const module = await import(caseFile.absolute);
  return module.default as Case<Context>;
}
