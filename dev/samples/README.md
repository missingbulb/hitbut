# Reconnaissance samples

Raw payloads from candidate sources, fetched by the
[fetch-samples workflow](../../.github/workflows/fetch-samples.yml) and committed so that
every question about a source is answered from bytes in this repo rather than from another
request. Nothing here is test data: cases and their expected values live under
[`dev/requirements/`](../requirements).

| | |
|---|---|
| [`candidates.json`](candidates.json) | the list the job works down — a URL, the surface we expect, and the question it is meant to answer |
| `payloads/` | what came back, named for the candidate and extended by what the bytes actually are |
| `report.GENERATED.md` | per candidate: saved, already saved, or refused, and why |

**The fetching happens in one place.** Agent sessions are denied `knesset.gov.il` and
`www.gov.il` by their egress policy — a policy boundary, not an obstacle — so the workflow
is the only sanctioned fetcher, and it runs the shipped
[`acquisition/fetcher.ts`](../../src/backend/acquisition/fetcher.ts) rather than a second
copy of the headers, the politeness delay and the retry policy.

**Adding a candidate** is an edit to `candidates.json` and a dispatch. The second round of
reconnaissance is the same move: when a page turns out to be a shell, its script bundle
paths become candidates, and reading them needs only the public site host.

Keep a payload to what answers the question — an OData page of 200 rows, not the whole
archive. The corpus's own data does not come from here; it comes from the crawl, from
production.
