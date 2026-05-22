import { describe, expect, it } from "vitest";

import { parseEnv } from "../lib/env";

const validEnv = {
  NODE_ENV: "test",
  SHOPIFY_API_KEY: "test_key",
  SHOPIFY_API_SECRET: "test_secret",
  SHOPIFY_APP_URL: "https://example.test",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
  SESSION_SECRET: "a".repeat(32),
  LOG_LEVEL: "silent",
  LOCAL_STORAGE_ROOT: "storage/test",
};

describe("env validation", () => {
  it("parses a valid environment", () => {
    expect(parseEnv(validEnv).NODE_ENV).toBe("test");
  });

  it("rejects short session secrets", () => {
    expect(() => parseEnv({ ...validEnv, SESSION_SECRET: "short" })).toThrow();
  });
});
