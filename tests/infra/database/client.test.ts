import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { env } from "../../../src/infra/config/env.ts";
import { createPool } from "../../../src/infra/database/client.ts";

describe("createPool", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("logs an error from an idle client instead of crashing the process", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const failure = new Error(
      "terminating connection due to administrator command",
    );
    const pool = createPool(env);

    expect(() => pool.emit("error", failure)).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), failure);

    await pool.end();
  });
});
