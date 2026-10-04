import { serve } from "@hono/node-server";
import { env } from "../infra/config/env.ts";
import { createApp } from "./app.ts";

serve({ fetch: createApp().fetch, port: env.PORT }, (info) => {
  console.log(`Listening on http://localhost:${info.port}`);
});
