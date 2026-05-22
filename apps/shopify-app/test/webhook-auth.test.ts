import { createHmac } from "node:crypto";

import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import { describe, expect, it } from "vitest";

import { parseEnv } from "../lib/env";
import { createShopifyServer } from "../app/lib/shopify.server";
import { normalizeShopifyWebhookTopic } from "@shoppable-video/shopify";

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

const sessionStorage: SessionStorage = {
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

function signedWebhookRequest(rawBody: string, hmacBody = rawBody): Request {
  const hmac = createHmac("sha256", env.SHOPIFY_API_SECRET).update(hmacBody, "utf8").digest("base64");

  return new Request("https://app.example.test/webhooks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-api-version": env.SHOPIFY_API_VERSION,
      "x-shopify-hmac-sha256": hmac,
      "x-shopify-shop-domain": "test-shop.myshopify.com",
      "x-shopify-topic": "app/uninstalled",
      "x-shopify-webhook-id": "delivery_1",
    },
    body: rawBody,
  });
}

describe("Shopify webhook authentication", () => {
  it("accepts a valid raw-body HMAC signature", async () => {
    const shopify = createShopifyServer({ env, sessionStorage });

    const webhook = await shopify.authenticate.webhook(
      signedWebhookRequest("{\"shop_domain\":\"test-shop.myshopify.com\"}"),
    );

    expect(webhook.shop).toBe("test-shop.myshopify.com");
    expect(normalizeShopifyWebhookTopic(webhook.topic)).toBe("app/uninstalled");
    expect(webhook.webhookId).toBe("delivery_1");
  });

  it("rejects an invalid HMAC signature", async () => {
    const shopify = createShopifyServer({ env, sessionStorage });

    await expect(
      shopify.authenticate.webhook(
        signedWebhookRequest("{\"shop_domain\":\"test-shop.myshopify.com\"}", "{\"changed\":true}"),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a missing HMAC signature", async () => {
    const shopify = createShopifyServer({ env, sessionStorage });
    const request = signedWebhookRequest("{\"shop_domain\":\"test-shop.myshopify.com\"}");
    request.headers.delete("x-shopify-hmac-sha256");

    await expect(shopify.authenticate.webhook(request)).rejects.toMatchObject({ status: 400 });
  });

  it("uses the exact raw body for verification", async () => {
    const shopify = createShopifyServer({ env, sessionStorage });
    const canonicalBody = "{\"shop_domain\":\"test-shop.myshopify.com\"}";
    const reformattedBody = "{ \"shop_domain\":\"test-shop.myshopify.com\" }";

    await expect(
      shopify.authenticate.webhook(signedWebhookRequest(reformattedBody, canonicalBody)),
    ).rejects.toMatchObject({ status: 401 });
  });
});
