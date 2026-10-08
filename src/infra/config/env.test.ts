import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "@jest/globals";
import { DEFAULT_PORT, parseEnv } from "./env.ts";

const ENV_MODULE = fileURLToPath(new URL("./env.ts", import.meta.url));

const DATABASE_URL = "postgres://user:pass@localhost:5432/app";
const MINIMAL_ENV = { DATABASE_URL };

describe("parseEnv", () => {
  it("defaults PORT when it is unset", () => {
    const result = parseEnv(MINIMAL_ENV);

    expect(result.success).toBe(true);
    expect(result.data?.PORT).toBe(DEFAULT_PORT);
  });

  it("parses PORT as a number", () => {
    expect(parseEnv({ ...MINIMAL_ENV, PORT: "8080" }).data?.PORT).toBe(8080);
  });

  it.each([
    ["empty", ""],
    ["zero", "0"],
    ["above 65535", "65536"],
    ["not a number", "abc"],
    ["not an integer", "3000.5"],
  ])("rejects a PORT that is %s", (_label, port) => {
    expect(parseEnv({ ...MINIMAL_ENV, PORT: port }).success).toBe(false);
  });

  it("requires DATABASE_URL", () => {
    const result = parseEnv({});

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["DATABASE_URL"],
    ]);
  });

  it.each([
    "postgres://user:pass@localhost:5432/app",
    "postgresql://user:pass@localhost:5432/app",
  ])("accepts %s", (url) => {
    expect(parseEnv({ DATABASE_URL: url }).data?.DATABASE_URL).toBe(url);
  });

  it.each([
    ["empty", ""],
    ["not a URL", "localhost:5432/app"],
    ["an http URL", "http://user:pass@localhost:5432/app"],
  ])("rejects a DATABASE_URL that is %s", (_label, url) => {
    expect(parseEnv({ DATABASE_URL: url }).success).toBe(false);
  });
});

describe("loading the env module", () => {
  it("exits with 1 and names the variable when PORT is invalid", () => {
    const child = spawnSync(process.execPath, [ENV_MODULE], {
      env: { ...process.env, PORT: "abc" },
      encoding: "utf8",
    });

    expect(child.status).toBe(1);
    expect(child.stderr).toContain("PORT");
  });

  it("never echoes the password in an invalid DATABASE_URL", () => {
    const child = spawnSync(process.execPath, [ENV_MODULE], {
      env: { ...process.env, DATABASE_URL: "http://user:s3cret@localhost/app" },
      encoding: "utf8",
    });

    expect(child.status).toBe(1);
    expect(child.stderr).toContain("DATABASE_URL");
    expect(child.stderr).not.toContain("s3cret");
  });
});
