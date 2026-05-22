import { z } from "zod";

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["development", "preview", "production", "test"]).default("development"),
  APP_URL: z.string().url().optional(),
  SHOPIFY_API_KEY: z.string().min(1),
  SHOPIFY_API_SECRET: z.string().min(1),
  SHOPIFY_APP_URL: z.string().url(),
  SHOPIFY_SCOPES: z.string().min(1),
  SHOPIFY_API_VERSION: z.enum([
    "2024-10",
    "2025-01",
    "2025-04",
    "2025-07",
    "2025-10",
    "2026-01",
    "2026-04",
    "unstable",
  ]),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  LOCAL_STORAGE_ROOT: z.string().min(1).default("storage/local"),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function parseEnv(input: NodeJS.ProcessEnv): AppEnv {
  return EnvSchema.parse(input);
}
