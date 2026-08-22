-- Emergent subjects, the stance of each utterance within one, and the findings a stance
-- series produces. Additive: nothing here is read by the shipped Worker yet, so the
-- deploy that applies it can be the deploy that introduces it.

-- A subject the corpus discovered rather than one anybody chose in advance. The label is
-- regenerated from the members and is display only — every join, every finding and every
-- comparison keys on the id, so relabelling moves nothing.
CREATE TABLE clusters (
  id         TEXT PRIMARY KEY,          -- ULID, minted once
  label      TEXT,                      -- NULL until enough members exist to name it
  created_at TEXT NOT NULL
);

-- One utterance's assignment. The distance it joined at is kept so a reader can ask why
-- it landed here rather than in the neighbouring cluster.
CREATE TABLE cluster_members (
  utterance_id TEXT PRIMARY KEY REFERENCES utterances(id),
  cluster_id   TEXT NOT NULL REFERENCES clusters(id),
  distance     REAL,
  assigned_at  TEXT NOT NULL
);

CREATE INDEX cluster_members_by_cluster ON cluster_members (cluster_id);

-- Where one utterance sits on its cluster's own axis. Embedding distance measures
-- aboutness, not agreement, so position is a recorded judgment and never something read
-- off the geometry — which is only defensible with the model and prompt attached.
--
-- Nothing is ever overwritten: a re-run under a new model or prompt writes its own row
-- beside the old one, and the pair is what tells them apart.
CREATE TABLE stances (
  id             TEXT PRIMARY KEY,      -- ULID, minted once
  utterance_id   TEXT NOT NULL REFERENCES utterances(id),
  cluster_id     TEXT NOT NULL REFERENCES clusters(id),
  position       REAL NOT NULL,         -- -1..1 along the cluster's axis
  confidence     REAL NOT NULL,         -- 0..1
  model_version  TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  UNIQUE (utterance_id, model_version, prompt_version)
);

CREATE INDEX stances_by_cluster ON stances (cluster_id, utterance_id);

-- A surfaced inconsistency. The two kinds answer different questions, and the table
-- refuses a record that is missing its own answer: an anomaly's point is who they were
-- talking to, a trend change's is when it moved. Stored without those, a finding reads
-- as complete and is not.
CREATE TABLE findings (
  id             TEXT PRIMARY KEY,      -- ULID, minted once
  figure_id      TEXT NOT NULL REFERENCES figures(id),
  cluster_id     TEXT NOT NULL REFERENCES clusters(id),
  kind           TEXT NOT NULL CHECK (kind IN ('anomaly', 'trend-change')),
  rationale      TEXT NOT NULL,
  score          REAL NOT NULL,
  -- An anomaly's point. Audience stays nullable: plenty of sources establish the venue
  -- and say nothing about who was in the room.
  venue          TEXT,
  audience       TEXT,
  -- A trend change's point, as an interval. A series bounds the change between two
  -- observations and no further, so a single date would be a claim it cannot make.
  changed_after  TEXT,
  changed_before TEXT,
  model_version  TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  superseded_by  TEXT REFERENCES findings(id),
  surfaced       INTEGER NOT NULL,
  CHECK (
    (kind = 'anomaly'      AND venue IS NOT NULL AND changed_after IS NULL     AND changed_before IS NULL)
    OR
    (kind = 'trend-change' AND venue IS NULL     AND audience IS NULL
                           AND changed_after IS NOT NULL AND changed_before IS NOT NULL)
  )
);

CREATE INDEX findings_live ON findings (figure_id, cluster_id, superseded_by);

-- Which utterances a finding rests on, and what each one is doing in it: the deviating
-- one for an anomaly, the two either side of the change point for a trend change.
CREATE TABLE finding_utterances (
  finding_id   TEXT NOT NULL REFERENCES findings(id),
  utterance_id TEXT NOT NULL REFERENCES utterances(id),
  role         TEXT NOT NULL CHECK (role IN ('deviating', 'before', 'after')),
  PRIMARY KEY (finding_id, utterance_id)
);
