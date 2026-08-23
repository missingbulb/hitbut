-- What the scheduled pass did, per source module, kept rather than discarded.
--
-- Acquisition and the ingestion chain already produce this: counts fetched and taken from
-- cache, and a reason per item that failed. Until now the handler returned and all of it
-- went out of scope, so the only way to know whether the crawl was working was to watch a
-- log stream nobody watches.
--
-- One row per module per pass, not one per pass: modules run on their own clocks, and the
-- question is always about a module — this one has not run since Tuesday — never about
-- the pass as a whole.
CREATE TABLE runs (
  id            TEXT PRIMARY KEY,          -- ULID, minted once
  source_module TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  finished_at   TEXT NOT NULL,
  -- What the pass moved. Zero here is a real zero: the module ran and found nothing new.
  -- A module that has never run has no row at all, which is what keeps never-run and
  -- found-nothing distinguishable (8.6) — absence is the encoding of unknown.
  fetched       INTEGER NOT NULL,
  cached        INTEGER NOT NULL,
  utterances    INTEGER NOT NULL,
  unattributed  INTEGER NOT NULL,
  -- The reasons, as a JSON array of {key, reason}. Held as one blob rather than a table:
  -- nothing joins on a failure, they are read as a list beside the run they belong to,
  -- and a run with four hundred of them should still be one row to fetch.
  failures      TEXT NOT NULL DEFAULT '[]'
);

-- Every read is "the latest run for each module", so the index is the query.
CREATE INDEX runs_by_module ON runs (source_module, started_at DESC);
