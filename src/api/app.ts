import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { healthRoutes } from "./routes/health.ts";

export function createApp() {
  const app = new OpenAPIHono();

  app.route("/", healthRoutes());

  app.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Incident Intelligence API", version: "0.1.0" },
  });

  app.get("/docs", swaggerUI({ url: "/openapi.json", version: "5.33.1" }));

  return app;
}
