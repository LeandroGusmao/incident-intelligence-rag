// Tests run as native ESM (the `jest` script passes --experimental-vm-modules).
// SWC only strips types; `npm run typecheck` is what checks them.
const INTEGRATION_DIR = "<rootDir>/tests/integration";

const base = {
  testEnvironment: "node",
  // Unit tests need it too: anything that imports env.ts needs DATABASE_URL.
  setupFiles: [`${INTEGRATION_DIR}/setup/env.ts`],
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      { jsc: { parser: { syntax: "typescript" }, target: "es2024" } },
    ],
  },
};

/** @type {import('jest').Config} */
export default {
  projects: [
    {
      ...base,
      displayName: "unit",
      testMatch: ["<rootDir>/src/**/*.test.ts"],
    },
    {
      ...base,
      // Needs postgres-test. Files share one database, so the
      // `test:integration` script runs them serially (--runInBand).
      displayName: "integration",
      testMatch: [`${INTEGRATION_DIR}/**/*.test.ts`],
      globalSetup: `${INTEGRATION_DIR}/setup/migrate-test-database.ts`,
    },
  ],
};
