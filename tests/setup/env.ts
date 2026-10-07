import { TEST_DATABASE_URL } from "./test-database-url.ts";

// `env.ts` exits at load without DATABASE_URL, so Jest sets it before any test imports it.
// Unconditional: a DATABASE_URL exported in the shell must never reach the tests.
process.env.DATABASE_URL = TEST_DATABASE_URL;
