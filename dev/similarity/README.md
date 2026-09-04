# The claim-distance comparison

Runs the comparison [`docs/architecture/claim-similarity.md`](../../docs/architecture/claim-similarity.md)
§5 defines: a labelled set of claim pairs, a list of methods, and one report that says how
well each method retrieves a claim's logical partners, keeps subjects apart, and names the
relation between two claims — at what cost.

```sh
node dev/similarity/run.ts                                   # the fictional sample, the lexical baseline
node dev/similarity/run.ts --pairs <file.jsonl> --out report.json
node dev/similarity/run.ts --methods lexical,embedding:bge-m3  # errors until that model is wired
```

| File | What it is |
|---|---|
| `pairs.ts` | the record format and its reader — five relations, two annotators, refused if malformed |
| `methods.ts` | the two seams a method fills (retriever, pair judge), the lexical baseline, and the adapters a real model plugs into |
| `measure.ts` | the paper's syntactic–semantic Jaccard measure, pure, pinned to the paper's worked example |
| `metrics.ts` | recall@k, MRR, separation (AUROC), per-relation precision/recall |
| `compare.ts` | the protocol and the report |
| `fixtures/pairs.sample.jsonl` | a fictional Hebrew set that proves the harness and measures no model |

**What runs today** is the lexical baseline: Hebrew-aware token overlap, the folding the
search index already does. Its report is the floor. Every other method is an adapter over
a model port — `Embedder` from the ingestion ports for retrieval, `PairModel` or
`ClauseModel` for judgment — and is wired in `resolveMethods` once the model is reachable
(#27). Naming an unwired method is an error, not a skipped column.

**The sample set is fictional**, like every fixture in this repository. A number read off
it says the harness works, and nothing about any model. The real set is §5.1 of the
design document: one persona's actual speech, two annotators, hard negatives on purpose.
