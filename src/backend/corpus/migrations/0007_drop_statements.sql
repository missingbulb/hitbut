-- contract-of: utterances
--
-- The contract step of the utterances expand (`0002`). Every reader moved to utterances and
-- findings in #52; these three tables have been written and read by nothing since.
--
-- Deliberately taken **before** the first deploy rather than after. The window this
-- discipline exists to protect is between applying migrations and replacing the running
-- Worker — and there is no running Worker, no account, and a corpus of fixtures. After the
-- first deploy this same change is the hard case the whole three-step split is for.
DROP TABLE judgments;
DROP TABLE statements_fts;
DROP TABLE statements;
