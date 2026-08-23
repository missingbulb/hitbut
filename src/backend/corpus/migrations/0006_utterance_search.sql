-- The search index over utterances, so the site can search what it now shows.
--
-- A second index rather than a repointed one: `statements_fts` is still written and still
-- correct for the shape it indexes, and this is the expand step's other half — the reader
-- moves, the old index goes with the old table in the contract step.
--
-- The indexed text is the *folded* form, not the quote: Hebrew glues prefixes onto words
-- and FTS5 knows nothing about that, so folding happens on the way in and on the way out
-- and the two must agree. The utterance keeps the fullest wording any attestation carries,
-- which is what makes indexing it rather than each attestation the right call — otherwise
-- one speech carried by five outlets is five hits for one sentence.
CREATE VIRTUAL TABLE utterances_fts USING fts5 (
  utterance_id UNINDEXED,
  search_text,
  tokenize = 'unicode61'
);
