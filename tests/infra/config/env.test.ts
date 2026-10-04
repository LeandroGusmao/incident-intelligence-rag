import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "@jest/globals";
import { DEFAULT_PORT, parseEnv } from "../../../src/infra/config/env.ts";

const ENV_MODULE = fileURLToPath(
  new URL("../../../src/infra/config/env.ts", import.meta.url),
);

describe("parseEnv", () => {
  it("defaults PORT when it is unset", () => {
    const result = parseEnv({});

    expect(result.success).toBe(true);
    expect(result.data?.PORT).toBe(DEFAULT_PORT);
  });

  it("parses PORT as a number", () => {
    expect(parseEnv({ PORT: "8080" }).data?.PORT).toBe(8080);
  });

  it.each([
    ["empty", ""],
    ["zero", "0"],
    ["above 65535", "65536"],
    ["not a number", "abc"],
    ["not an integer", "3000.5"],
  ])("rejects a PORT that is %s", (_label, port) => {
    expect(parseEnv({ PORT: port }).success).toBe(false);
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
});
