import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

const HealthResponseSchema = z.object({ status: z.literal("ok") });

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  responses: {
    200: {
      description: "The service is up",
      content: { "application/json": { schema: HealthResponseSchema } },
    },
  },
});

export function healthRoutes() {
  return new OpenAPIHono().openapi(healthRoute, (c) =>
    c.json({ status: "ok" }, 200),
  );
}
