-- What the roster decided about each person, kept beside them rather than looked up from
-- the file whenever a page wants it. Both are decisions rather than observations, so they
-- travel with the record.
--
-- Additive and nullable: the running Worker neither writes nor reads them, and a figure
-- that predates the roster simply has neither until the next sync fills them in.

-- The written test this person meets, published on the methodology page.
ALTER TABLE figures ADD COLUMN qualifies TEXT;

-- Which source modules reach this person and from when, as the roster's own JSON.
ALTER TABLE figures ADD COLUMN coverage TEXT;
