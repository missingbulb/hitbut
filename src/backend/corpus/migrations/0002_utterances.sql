-- Utterances and attestations, alongside the statements table rather than replacing it.
-- This is the expand step: nothing is dropped or renamed, so the running Worker keeps
-- working against the schema it knows while readers move over one at a time.
-- expand: utterances

CREATE TABLE utterances (
  id                TEXT PRIMARY KEY,          -- ULID, minted once
  figure_id         TEXT NOT NULL REFERENCES figures(id),
  -- The fullest wording any document carries. A quote trimmed for space must not
  -- become the record, so a longer attestation replaces a shorter one here.
  text              TEXT NOT NULL,
  language          TEXT NOT NULL CHECK (language IN ('he', 'en')),
  -- NULL means the source establishes no date at all. When it does, the precision says
  -- how far: a source that gives "March 1998" and no more is a month, not the first of it.
  said_at           TEXT,
  said_at_precision TEXT CHECK (said_at_precision IN ('day', 'month', 'year')),
  -- Where it was said and to whom: a property of the speech act, not of whoever
  -- reported it. The same words to a committee and at a rally are two utterances, and
  -- that difference is the whole point of an anomaly.
  venue             TEXT NOT NULL CHECK (venue IN
                      ('plenary', 'committee', 'interview', 'press-conference', 'op-ed',
                       'broadcast', 'rally', 'party-forum', 'written-statement', 'other')),
  audience          TEXT CHECK (audience IN
                      ('general-public', 'parliament', 'party-members', 'foreign-press', 'professional')),
  -- The folded text with when and where it was said: what two documents reporting one
  -- speech agree on, and what keeps the same words at two venues two utterances.
  merge_key         TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  UNIQUE (figure_id, merge_key),
  -- A precision without a date, or a date without one, would be a third thing neither
  -- readers nor writers have a meaning for. Table-level, because SQLite only accepts
  -- multi-column constraints after every column is declared.
  CHECK ((said_at IS NULL) = (said_at_precision IS NULL))
);

CREATE INDEX utterances_by_figure ON utterances (figure_id, said_at DESC);

CREATE TABLE attestations (
  id           TEXT PRIMARY KEY,
  utterance_id TEXT NOT NULL REFERENCES utterances(id),
  source_id    TEXT NOT NULL REFERENCES sources(id),
  -- The text as this document renders it, kept verbatim even when the utterance holds a
  -- fuller version: what each outlet actually printed is itself part of the record.
  text         TEXT NOT NULL,
  -- When the document was published, never confused with when the words were said.
  published_at TEXT,
  created_at   TEXT NOT NULL,
  UNIQUE (utterance_id, source_id)
);

CREATE INDEX attestations_by_utterance ON attestations (utterance_id);
