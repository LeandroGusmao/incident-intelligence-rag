import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { migrate } from "../../../src/infra/database/migrator.ts";
import { TEST_DATABASE_URL } from "../../setup/test-database-url.ts";

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../../migrations/", import.meta.url),
);

// From scratch on every run: an edit to an unmerged migration would otherwise
// fail its checksum here until the container restarts.
const RESET_SCHEMA = "DROP SCHEMA public CASCADE; CREATE SCHEMA public";

function isConnectionRefused(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as NodeJS.ErrnoException).code === "ECONNREFUSED"
  );
}

/** Jest's globalSetup for the integration project: an empty, fully migrated test database. */
export default async function migrateTestDatabase(): Promise<void> {
  // Not createPool(env): this runs in Jest's main process, which setupFiles
  // never reaches, so env.ts would validate the shell's environment.
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  try {
    await pool.query(RESET_SCHEMA);
    await migrate(pool, MIGRATIONS_DIR);
  } catch (error) {
    if (isConnectionRefused(error)) {
      throw new Error(
        "cannot reach the test database; start it with: docker compose up -d --wait postgres-test",
        { cause: error },
      );
    }
    throw error;
  } finally {
    await pool.end();
  }
}
