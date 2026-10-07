import { fileURLToPath } from "node:url";
import { env } from "../infra/config/env.ts";
import { createPool } from "../infra/database/client.ts";
import { migrate } from "../infra/database/migrator.ts";

/** `migrations/` at the repo root: two levels up from both `src/main/` and `dist/main/`. */
const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../migrations/", import.meta.url),
);

const pool = createPool(env);

try {
  const applied = await migrate(pool, MIGRATIONS_DIR);
  console.log(
    applied.length === 0
      ? "Database is up to date."
      : `Applied ${applied.length} migration(s):\n${applied.map((name) => `  ${name}`).join("\n")}`,
  );
} catch (error) {
  // The whole error, not just the message: Postgres' detail and hint sit in its cause.
  console.error("Migration failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
