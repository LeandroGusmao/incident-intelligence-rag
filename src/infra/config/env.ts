import { z } from "zod";

/**
 * Only place in the project that reads `process.env`.
 * Every consumer receives the already-validated config via injection.
 */
export const DEFAULT_PORT = 3000;
const MAX_PORT = 65_535;

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(MAX_PORT).default(DEFAULT_PORT),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validation without the side effect, so it can be exercised in isolation.
 * Reading `process.env` and killing the process stay below.
 */
export function parseEnv(source: unknown) {
  return envSchema.safeParse(source);
}

const parsed = parseEnv(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:\n");
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

export const env: Env = parsed.data;
