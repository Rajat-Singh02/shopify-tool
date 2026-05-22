import { ApiVersion } from "@shopify/shopify-app-react-router/server";
import { describe, expect, it } from "vitest";

import { parseEnv } from "../lib/env";
import { createShopifyServer, createShopifyServerConfig } from "../app/lib/shopify.server";

const env = parseEnv({
  NODE_ENV: "test",
  APP_ENV: "test",
  APP_URL: "https://app.example.test",
  SHOPIFY_API_KEY: "test_key",
  SHOPIFY_API_SECRET: "test_secret",
  SHOPIFY_APP_URL: "https://app.example.test",
  SHOPIFY_SCOPES: "read_products",
  SHOPIFY_API_VERSION: "2026-04",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
  SESSION_SECRET: "a".repeat(32),
  LOG_LEVEL: "silent",
  LOCAL_STORAGE_ROOT: "storage/test",
});

describe("createShopifyServer", () => {
  it("uses env-backed Shopify configuration and DB-backed session storage", () => {
    const sessionStorage = {
      storageType: "prisma",
      storeSession() {
        return Promise.resolve(true);
      },
      loadSession() {
        return Promise.resolve(undefined);
      },
      deleteSession() {
        return Promise.resolve(true);
      },
      deleteSessions() {
        return Promise.resolve(true);
      },
      findSessionsByShop() {
        return Promise.resolve([]);
      },
    };

    const config = createShopifyServerConfig({ env, sessionStorage });
    const shopify = createShopifyServer({ env, sessionStorage });

    expect(config.apiVersion).toBe(ApiVersion.April26);
    expect(config.scopes).toEqual(["read_products"]);
    expect(shopify.sessionStorage).toBe(sessionStorage);
    expect(shopify.sessionStorage).toMatchObject({ storageType: "prisma" });
  });
});
