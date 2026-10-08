import { describe, expect, it } from "@jest/globals";
import { createApp } from "./app.ts";

describe("GET /docs", () => {
  it("serves a Swagger UI page that loads the spec from /openapi.json", async () => {
    const res = await createApp().request("/docs");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/html/);
    expect(await res.text()).toContain("/openapi.json");
  });

  it("pins the Swagger UI assets to an exact version", async () => {
    const res = await createApp().request("/docs");

    expect(await res.text()).toMatch(/swagger-ui-dist@\d+\.\d+\.\d+\//);
  });
});
