// Runs the comparison from the command line and writes the report.
//
// Usage: node dev/similarity/run.ts [--pairs <file.jsonl>] [--methods lexical,...] [--out <report.json>]
//
// Only `lexical` resolves today. A model-backed method is wired in `methods.ts` once the
// model is reachable (#27); naming one before then is an error rather than a silent skip,
// so a report never reads as a comparison it did not run.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { compare, renderReport } from './compare.ts';
import { lexicalJudge, lexicalRetriever } from './methods.ts';
import type { Methods } from './compare.ts';
import { readPairs } from './pairs.ts';

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

export const SAMPLE_PAIRS = path.join(import.meta.dirname, 'fixtures', 'pairs.sample.jsonl');

/** The methods a name resolves to. Extend here, and only here, when a model lands. */
export function resolveMethods(names: string[]): Methods {
  const methods: Methods = { retrievers: [], judges: [] };
  for (const name of names) {
    if (name === 'lexical') {
      methods.retrievers.push(lexicalRetriever());
      methods.judges.push(lexicalJudge());
    } else {
      throw new Error(`no adapter for method "${name}" — wire it in dev/similarity/methods.ts once its model is reachable (#27)`);
    }
  }
  return methods;
}

if (import.meta.main) {
  const pairsFile = argument('pairs') ?? SAMPLE_PAIRS;
  const names = (argument('methods') ?? 'lexical')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const report = await compare(readPairs(pairsFile), resolveMethods(names));
  console.log(renderReport(report));
  const out = argument('out');
  if (out) {
    writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`\nwritten to ${out}`);
  }
}
