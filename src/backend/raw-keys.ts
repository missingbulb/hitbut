// The layout of the raw payload bucket, in one place, because it has two shapes and the
// difference between them is deliberate.
//
// Both jobs store a payload verbatim before anything interprets it. They disagree about
// what an object *is*, and that follows from what each one is looking at:
//
//   crawl    <module>/<document>/<fetchedAt>.raw   one object per fetch
//   archive  <module>/<document>.raw               one object per document
//
// The crawl re-reads pages that can change, so every fetch is its own object and an
// attestation's stored key resolves to the bytes that attestation was read from, forever.
// The archive walks documents that cannot change, and a retried Workflow step re-runs from
// the top: it has to *find* what the previous attempt stored, which a key carrying that
// attempt's clock could never do.
//
// A consequence worth stating rather than discovering: the two namespaces do not meet. A
// backfill will not find a document the crawl already fetched, and re-fetches it once.
import type { SourceModule } from './acquisition/registry.ts';

/** One object per fetch — the crawl's shape, addressed so an old fetch stays readable. */
export const crawlRawKey = (module: SourceModule, documentKey: string, fetchedAt: string): string =>
  `${module.id}/${encodeURIComponent(documentKey)}/${fetchedAt}.raw`;

/** One object per document — the archive's shape, addressed so a retry finds it. */
export const archiveRawKey = (module: SourceModule, documentKey: string): string =>
  `${module.id}/${encodeURIComponent(documentKey)}.raw`;
