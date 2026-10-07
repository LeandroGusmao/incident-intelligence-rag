import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolClient } from "pg";
import {
  type MigrationFile,
  MigrationError,
  planMigrations,
} from "./migration-plan.ts";

interface MigrationSource extends MigrationFile {
  readonly sql: string;
}

/** Serializes concurrent runs. Any value works if nothing else locks on it. */
const MIGRATION_LOCK_KEY = 4_918_207_316;

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name       text PRIMARY KEY,
    checksum   text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;
const SELECT_APPLIED = "SELECT name, checksum FROM schema_migrations";
const INSERT_APPLIED =
  "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)";

const SQL_EXTENSION = ".sql";

async function readMigrationFiles(dir: string): Promise<MigrationSource[]> {
  const names = (await readdir(dir)).filter((name) =>
    name.endsWith(SQL_EXTENSION),
  );
  return Promise.all(
    names.map(async (name) => {
      const bytes = await readFile(join(dir, name));
      return {
        name,
        // Raw bytes: any edit to an applied migration, even whitespace, is a change.
        checksum: createHash("sha256").update(bytes).digest("hex"),
        sql: bytes.toString("utf8"),
      };
    }),
  );
}

async function apply(client: PoolClient, file: MigrationSource): Promise<void> {
  try {
    // No parameters: the simple query protocol runs every statement in the file.
    await client.query(file.sql);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new MigrationError(`${file.name} failed: ${reason}`, {
      cause: error,
    });
  }
  await client.query(INSERT_APPLIED, [file.name, file.checksum]);
}

/**
 * Applies the pending `.sql` files in `dir`, in name order, and returns their
 * names. The whole run is one transaction: if any file fails, nothing is
 * applied. Files must not contain `BEGIN`/`COMMIT` or anything that can't run
 * inside a transaction, such as `CREATE INDEX CONCURRENTLY`.
 */
export async function migrate(pool: Pool, dir: string): Promise<string[]> {
  const files = await readMigrationFiles(dir);

  const client = await pool.connect();
  let rollbackFailed = false;
  try {
    await client.query("BEGIN");
    // Lock first: concurrent CREATE TABLE IF NOT EXISTS can still collide.
    await client.query("SELECT pg_advisory_xact_lock($1)", [
      MIGRATION_LOCK_KEY,
    ]);
    await client.query(CREATE_MIGRATIONS_TABLE);
    const { rows } = await client.query<MigrationFile>(SELECT_APPLIED);

    const pending = planMigrations(files, rows);
    for (const file of pending) {
      await apply(client, file);
    }

    await client.query("COMMIT");
    return pending.map((file) => file.name);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      rollbackFailed = true;
    }
    throw error;
  } finally {
    // A failed ROLLBACK may leave the transaction open: destroy the client instead of pooling it.
    client.release(rollbackFailed);
  }
}
