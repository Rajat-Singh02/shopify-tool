import { describe, expect, it } from "vitest";

import {
  createWebhookPayloadHash,
  isAppUninstalledTopic,
  normalizeShopifyWebhookTopic,
} from "./webhooks";

describe("webhook helpers", () => {
  it("normalizes Shopify webhook topic variants", () => {
    expect(normalizeShopifyWebhookTopic("APP_UNINSTALLED")).toBe("app/uninstalled");
    expect(isAppUninstalledTopic("app/uninstalled")).toBe(true);
  });

  it("hashes the exact raw webhook body", () => {
    expect(createWebhookPayloadHash("{\"shop\":\"test.myshopify.com\"}")).not.toBe(
      createWebhookPayloadHash("{ \"shop\":\"test.myshopify.com\" }"),
    );
  });
});
