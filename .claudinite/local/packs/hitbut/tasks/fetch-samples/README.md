# fetch-samples

Fetches the candidate source URLs in [`dev/samples/candidates.json`](../../../../../../dev/samples/candidates.json)
and delivers the payloads on a pull request, so every question about a source is then
answered from bytes in this repo rather than from another request to that source.

It exists as a task because it is the only place hitbut may reach a candidate source from:
agent sessions are denied `knesset.gov.il` and `www.gov.il` by their egress policy, and
that is a boundary to respect rather than route around.

**Running it.** It has no cadence — nothing here needs to be current, and a recurring crawl
of sites we are asking a favour of is the traffic most likely to get us blocked. Wake it by
dispatching the scheduler workflow with `wake` set to `hitbut/fetch-samples`.

**Parameters** ride the work item's Context, one per line:

```
force: true          re-fetch candidates whose payload is already committed
only: knesset-odata-person,govil-news-api    just these candidates
```

**What it delivers.** The payloads and the regenerated report, on a PR that is left for a
person: these are bytes from sites we do not own, and reviewing them is the point.
A run where every candidate was already saved delivers nothing, which is an empty outcome
rather than a skip.

The fetching itself lives in [`dev/tools/fetch-samples.ts`](../../../../../../dev/tools/fetch-samples.ts),
runnable by hand as `npm run fetch-samples`; this worker adds only what makes sense inside
a run — the operator's parameters, and the delivery.
