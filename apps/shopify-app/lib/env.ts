import { z } from "zod";

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SHOPIFY_API_KEY: z.string().min(1),
  SHOPIFY_API_SECRET: z.string().min(1),
  SHOPIFY_APP_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  LOCAL_STORAGE_ROOT: z.string().min(1).default("storage/local"),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function parseEnv(input: NodeJS.ProcessEnv): AppEnv {
  return EnvSchema.parse(input);
}
