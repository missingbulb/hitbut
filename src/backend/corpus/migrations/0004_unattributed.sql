-- Passages by speakers we do not track. Not tracked is not the same as not recorded:
-- dropping them would make the raw record incomplete and would decide at crawl time
-- something a person should decide, and promoting them would create exactly the tracked
-- figure a roster exists to prevent (issue #31).
--
-- A table of their own rather than a nullable figure on utterances: these participate in
-- nothing analysis does — no cluster, no stance, no finding — and what they actually are
-- is a queue of decisions waiting for a person, which is easier to read as its own list.
CREATE TABLE unattributed (
  id           TEXT PRIMARY KEY,          -- ULID, minted once
  source_id    TEXT NOT NULL REFERENCES sources(id),
  -- The speaker's name exactly as the document wrote it. Never normalized towards a
  -- roster name: the whole question about this row is whether those are the same person.
  speaker_name TEXT NOT NULL,
  speaker_role TEXT,
  -- Its position in the payload, so the statements that did resolve keep theirs and
  -- adding this speaker to the roster later moves nobody's id.
  ordinal      INTEGER NOT NULL,
  quote        TEXT NOT NULL,
  language     TEXT NOT NULL CHECK (language IN ('he', 'en')),
  said_at      TEXT,
  context      TEXT,
  created_at   TEXT NOT NULL,
  UNIQUE (source_id, ordinal)
);

CREATE INDEX unattributed_by_speaker ON unattributed (speaker_name);
