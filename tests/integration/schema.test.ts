import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import type { Pool } from "pg";
import { env } from "../../src/infra/config/env.ts";
import { createPool } from "../../src/infra/database/client.ts";

// Spelled out, not read from the migrations: these names are the contract.
// Asserting on them proves which rule rejected the row.
const SOURCE_TYPE_CHECK = "sources_source_type_check";
const CHANGED_FILES_CHECK = "changed_files_only_on_pull_requests";
const SOURCE_ID_UNIQUE = "sources_repository_source_id_key";
const CHUNK_INDEX_CHECK = "chunks_chunk_index_check";
const CHUNK_INDEX_UNIQUE = "chunks_source_pk_chunk_index_key";

const EMBEDDING_DIMENSIONS = 1536;
const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const REPOSITORY = "acme/billing";
const OTHER_REPOSITORY = "acme/payments";

interface SourceInput {
  repository?: string;
  sourceType?: string;
  sourceId?: string;
  changedFiles?: string[] | null;
}

interface InsertedSource {
  id: string;
  linked_source_ids: string[];
}

let pool: Pool;

beforeAll(() => {
  pool = createPool(env);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await pool.query("TRUNCATE sources CASCADE");
});

async function insertSource({
  repository = REPOSITORY,
  sourceType = "incident",
  sourceId = "INC-018",
  changedFiles = null,
}: SourceInput = {}): Promise<InsertedSource> {
  const { rows } = await pool.query<InsertedSource>(
    `INSERT INTO sources
       (repository, source_type, source_id, changed_files, content_hash, index_version, indexed_at)
     VALUES ($1, $2, $3, $4, 'hash', 'test:v1', now())
     RETURNING id, linked_source_ids`,
    [repository, sourceType, sourceId, changedFiles],
  );
  const [source] = rows;
  if (source === undefined) throw new Error("INSERT returned no row");
  return source;
}

function embedding(dimensions = EMBEDDING_DIMENSIONS): string {
  return JSON.stringify(Array.from({ length: dimensions }, () => 0));
}

async function insertChunk(
  sourcePk: string,
  chunkIndex: number,
  { content = "content", vector = embedding() } = {},
): Promise<{ search_tsv: string }> {
  const { rows } = await pool.query<{ search_tsv: string }>(
    `INSERT INTO chunks (source_pk, chunk_index, content, embedding)
     VALUES ($1, $2, $3, $4)
     RETURNING search_tsv::text AS search_tsv`,
    [sourcePk, chunkIndex, content, vector],
  );
  const [chunk] = rows;
  if (chunk === undefined) throw new Error("INSERT returned no row");
  return chunk;
}

describe("sources", () => {
  it("fills a uuidv7 id and an empty link list by default", async () => {
    const source = await insertSource();

    expect(source.id).toMatch(UUID_V7);
    expect(source.linked_source_ids).toEqual([]);
  });

  it("rejects an unknown source_type", async () => {
    await expect(insertSource({ sourceType: "wiki" })).rejects.toMatchObject({
      constraint: SOURCE_TYPE_CHECK,
    });
  });

  it("accepts changed_files only on pull requests", async () => {
    await expect(
      insertSource({
        sourceType: "pull_request",
        sourceId: "PR-87",
        changedFiles: ["src/billing/invoice.ts"],
      }),
    ).resolves.toBeDefined();

    await expect(
      insertSource({
        sourceType: "incident",
        changedFiles: ["src/billing/invoice.ts"],
      }),
    ).rejects.toMatchObject({ constraint: CHANGED_FILES_CHECK });
  });

  it("keeps source_id unique within a repository, not across repositories", async () => {
    await insertSource();

    await expect(insertSource()).rejects.toMatchObject({
      constraint: SOURCE_ID_UNIQUE,
    });
    await expect(
      insertSource({ repository: OTHER_REPOSITORY }),
    ).resolves.toBeDefined();
  });
});

describe("chunks", () => {
  it("rejects an embedding of any other size", async () => {
    const source = await insertSource();

    await expect(
      insertChunk(source.id, 0, { vector: embedding(3) }),
    ).rejects.toThrow(`expected ${EMBEDDING_DIMENSIONS} dimensions, not 3`);
  });

  it("rejects a negative chunk_index", async () => {
    const source = await insertSource();

    await expect(insertChunk(source.id, -1)).rejects.toMatchObject({
      constraint: CHUNK_INDEX_CHECK,
    });
  });

  it("rejects a second chunk with the same index in a source", async () => {
    const source = await insertSource();
    await insertChunk(source.id, 0);

    await expect(insertChunk(source.id, 0)).rejects.toMatchObject({
      constraint: CHUNK_INDEX_UNIQUE,
    });
  });

  it("are deleted with their source", async () => {
    const source = await insertSource();
    await insertChunk(source.id, 0);
    await insertChunk(source.id, 1);

    await pool.query("DELETE FROM sources WHERE id = $1", [source.id]);

    const { rows } = await pool.query("SELECT 1 FROM chunks");
    expect(rows).toHaveLength(0);
  });

  it("derive search_tsv from content with english stemming and stop words", async () => {
    const source = await insertSource();

    const chunk = await insertChunk(source.id, 0, {
      content: "Connections were timing out",
    });

    expect(chunk.search_tsv).toBe("'connect':1 'time':3");
  });
});
