import { Pool } from "pg";
import type { Env } from "../config/env.ts";

/** Tells this app's connections apart in `pg_stat_activity`, where every row otherwise reads `node-postgres`. */
const APPLICATION_NAME = "incident-intelligence-rag";

const POOL_ERROR_MESSAGE = "unexpected error on idle database client";

/** Pool size and timeouts stay at the `pg` defaults until a measurement asks otherwise: one local instance. */
export function createPool(env: Env): Pool {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    application_name: APPLICATION_NAME,
  });

  // An idle client that dies emits `error`; with no listener, Node throws and the process exits.
  pool.on("error", (err) => {
    console.error(POOL_ERROR_MESSAGE, err);
  });

  return pool;
}
