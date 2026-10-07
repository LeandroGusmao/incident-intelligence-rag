-- One row per dataset document. The text itself lives in `chunks`.
CREATE TABLE sources (
  -- uuidv7 (built into PG18) is time-ordered, so inserts append to the PK index.
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  repository        text NOT NULL,
  source_type       text NOT NULL
    CHECK (source_type IN ('code', 'issue', 'pull_request', 'incident')),
  -- Canonical id shared with citations and the eval set: 'INC-018', 'PR-87', a file path.
  source_id         text NOT NULL,
  title             text,
  authored_at       timestamptz,
  -- Explicit references only. No foreign key: a link may point outside the dataset.
  linked_source_ids text[] NOT NULL DEFAULT '{}',
  changed_files     text[]
    CONSTRAINT changed_files_only_on_pull_requests
    CHECK (changed_files IS NULL OR source_type = 'pull_request'),
  -- Ingestion skips a source when both match. index_version = '<chunker>:<embedding model>'.
  content_hash      text NOT NULL,
  index_version     text NOT NULL,
  indexed_at        timestamptz NOT NULL,
  -- The upsert key, and what lets a link resolve to exactly one source.
  UNIQUE (repository, source_id)
);
