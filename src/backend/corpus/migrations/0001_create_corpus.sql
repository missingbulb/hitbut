-- The corpus. Nothing here is ever deleted: withdrawal is a status, re-analysis
-- supersedes, and a re-extraction rewrites a statement's text under the id it already had.

CREATE TABLE figures (
  id            TEXT PRIMARY KEY,           -- slug, minted once, never reassigned
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL,
  aliases       TEXT NOT NULL DEFAULT '[]', -- JSON array
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  created_at    TEXT NOT NULL
);

CREATE TABLE sources (
  id            TEXT PRIMARY KEY,
  url           TEXT NOT NULL,
  publisher     TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('transcript', 'press-release', 'article', 'broadcast')),
  fetched_at    TEXT NOT NULL,              -- when we fetched, never when it was said
  raw_key       TEXT NOT NULL,              -- the verbatim payload in R2, written before any parse
  extraction    TEXT NOT NULL CHECK (extraction IN ('pending', 'extracted', 'failed', 'blocked')),
  source_module TEXT NOT NULL,
  -- The module's own key for this document. With the module it is what "already fetched"
  -- means, so a re-run issues no request for a document that is already cached.
  external_key  TEXT NOT NULL,
  UNIQUE (source_module, external_key)
);

CREATE TABLE statements (
  id         TEXT PRIMARY KEY,              -- ULID, minted at first extraction
  figure_id  TEXT NOT NULL REFERENCES figures(id),
  quote      TEXT NOT NULL,
  language   TEXT NOT NULL CHECK (language IN ('he', 'en')),
  -- NULL means the source does not establish a date. Not today, not the epoch, not the
  -- fetch time: a date we would have to invent is a date a timeline would sort by.
  said_at    TEXT,
  context    TEXT,
  source_id  TEXT NOT NULL REFERENCES sources(id),
  topics     TEXT NOT NULL DEFAULT '[]',    -- JSON array
  -- Position within the payload. With source_id this is the statement's natural key, so
  -- replaying the extractor over the same bytes finds the row it made last time.
  ordinal    INTEGER NOT NULL,
  UNIQUE (source_id, ordinal)
);

CREATE INDEX statements_by_figure ON statements (figure_id, said_at DESC);
CREATE INDEX statements_by_source ON statements (source_id);

-- Search. D1 cannot load a tokenizer that understands Hebrew morphology, so the folding
-- happens on our side and this column holds every token plus its stems; see src/shared/text.ts.
CREATE VIRTUAL TABLE statements_fts USING fts5 (
  statement_id UNINDEXED,
  search_text,
  tokenize = 'unicode61'
);

CREATE TABLE judgments (
  id                   TEXT PRIMARY KEY,
  figure_id            TEXT NOT NULL REFERENCES figures(id),
  earlier_statement_id TEXT NOT NULL REFERENCES statements(id),
  later_statement_id   TEXT NOT NULL REFERENCES statements(id),
  kind                 TEXT NOT NULL CHECK (kind IN ('contradiction', 'position-shift', 'consistent')),
  score                REAL NOT NULL,
  rationale            TEXT NOT NULL,
  model_version        TEXT NOT NULL,       -- the trail: which model,
  prompt_version       TEXT NOT NULL,       -- reading which committed prompt
  created_at           TEXT NOT NULL,
  -- Set when a re-analysis replaced this judgment. The row itself stays resolvable, so a
  -- citation of the old judgment degrades to "superseded by", never to a 404.
  superseded_by        TEXT REFERENCES judgments(id),
  surfaced             INTEGER NOT NULL CHECK (surfaced IN (0, 1))
);

CREATE INDEX judgments_surfaced ON judgments (surfaced, created_at DESC);
CREATE INDEX judgments_by_pair ON judgments (earlier_statement_id, later_statement_id);
CREATE INDEX judgments_by_figure ON judgments (figure_id, created_at DESC);
