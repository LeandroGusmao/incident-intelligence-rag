import { describe, expect, it } from "@jest/globals";
import { createApp } from "../../src/api/app.ts";

describe("GET /health", () => {
  it("responds 200 with a JSON status ok", async () => {
    const res = await createApp().request("/health");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("is documented in the OpenAPI spec", async () => {
    const res = await createApp().request("/openapi.json");

    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty(["paths", "/health", "get"]);
  });
});
