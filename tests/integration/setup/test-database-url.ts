/**
 * The database every test points at, through `DATABASE_URL`.
 *
 * Hardcoded on purpose, and not read from `.env` or the shell: this is a test
 * fixture, not configuration. The integration suite drops the schema on every
 * run, so a value inherited from the environment could wipe the development
 * database. A wrong value here shows up in a diff. It must match the
 * `postgres-test` service in docker-compose.yml.
 */
export const TEST_DATABASE_URL =
  "postgres://incident_intelligence:incident_intelligence_local_dev@127.0.0.1:5433/incident_intelligence_test";
