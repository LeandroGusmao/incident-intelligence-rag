// Tests run as native ESM (the `test` script passes --experimental-vm-modules).
// SWC only strips types; `npm run typecheck` is what checks them.
/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      { jsc: { parser: { syntax: "typescript" }, target: "es2024" } },
    ],
  },
};
