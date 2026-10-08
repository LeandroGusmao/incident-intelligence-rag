// Tests run as native ESM (the `jest` script passes --experimental-vm-modules).
// SWC only strips types; `npm run typecheck` is what checks them.
const base = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setup/env.ts"],
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      { jsc: { parser: { syntax: "typescript" }, target: "es2024" } },
    ],
  },
};

const INTEGRATION_DIR = "<rootDir>/tests/integration";

/** @type {import('jest').Config} */
export default {
  projects: [
    {
      ...base,
      displayName: "unit",
      testMatch: ["<rootDir>/tests/**/*.test.ts"],
      testPathIgnorePatterns: ["/node_modules/", `${INTEGRATION_DIR}/`],
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
