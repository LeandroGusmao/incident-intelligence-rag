-- The retrievable unit: one piece of a source's text, indexed for vector and full-text search.
CREATE TABLE chunks (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  source_pk   uuid NOT NULL REFERENCES sources (id) ON DELETE CASCADE,
  chunk_index int  NOT NULL CHECK (chunk_index >= 0),
  section     text,
  content     text NOT NULL,
  -- text-embedding-3-small's size. pgvector rejects any other, so two models never
  -- mix; a new model is a new migration plus a full reindex.
  embedding   vector(1536) NOT NULL,
  -- STORED: PG18 defaults to VIRTUAL, which can't take the GIN index Phase 3 adds.
  -- Two-argument to_tsvector: the one-argument form isn't immutable. Queries must use 'english' too.
  search_tsv  tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  -- Its index also covers lookups by source_pk (delete-and-reinsert, cascade).
  UNIQUE (source_pk, chunk_index)
);

-- No index on embedding: exact search (100% recall) is the baseline an
-- approximate index would be measured against.
