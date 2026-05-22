import { describe, expect, it } from "vitest";

import { processShopifyWebhook } from "../services/webhooks.server";

const shop = {
  id: "shop_1",
  shopDomain: "test-shop.myshopify.com",
  installedAt: new Date("2026-05-22T00:00:00.000Z"),
  uninstalledAt: null,
  createdAt: new Date("2026-05-22T00:00:00.000Z"),
  updatedAt: new Date("2026-05-22T00:00:00.000Z"),
};

function webhookRequest(body = "{\"shop_domain\":\"test-shop.myshopify.com\"}") {
  return new Request("https://app.example.test/webhooks", {
    method: "POST",
    body,
  });
}

describe("processShopifyWebhook", () => {
  it("records a delivery and marks a shop uninstalled", async () => {
    let uninstalledShopDomain: string | undefined;

    const result = await processShopifyWebhook(webhookRequest(), {
      authenticateWebhook() {
        return Promise.resolve({
          shop: shop.shopDomain,
          topic: "app/uninstalled",
          webhookId: "delivery_1",
        });
      },
      shopRepository: {
        findByDomain() {
          return Promise.resolve(shop);
        },
        markUninstalled(shopDomain) {
          uninstalledShopDomain = shopDomain;
          return Promise.resolve({ ...shop, uninstalledAt: new Date("2026-05-22T12:00:00.000Z") });
        },
      },
      webhookDeliveryRepository: {
        recordDelivery(input) {
          return Promise.resolve({
            isDuplicate: false,
            delivery: {
              id: "webhook_delivery_1",
              shopId: input.shopId ?? null,
              topic: input.topic,
              deliveryId: input.deliveryId,
              processedAt: new Date("2026-05-22T12:00:00.000Z"),
              payloadHash: input.payloadHash,
            },
          });
        },
      },
    });

    expect(result).toMatchObject({
      duplicate: false,
      handled: true,
      topic: "app/uninstalled",
      shopDomain: shop.shopDomain,
    });
    expect(uninstalledShopDomain).toBe(shop.shopDomain);
  });

  it("does not repeat side effects for duplicate deliveries", async () => {
    let uninstallCalls = 0;

    const result = await processShopifyWebhook(webhookRequest(), {
      authenticateWebhook() {
        return Promise.resolve({
          shop: shop.shopDomain,
          topic: "APP_UNINSTALLED",
          webhookId: "delivery_1",
        });
      },
      shopRepository: {
        findByDomain() {
          return Promise.resolve(shop);
        },
        markUninstalled() {
          uninstallCalls += 1;
          return Promise.resolve({ ...shop, uninstalledAt: new Date("2026-05-22T12:00:00.000Z") });
        },
      },
      webhookDeliveryRepository: {
        recordDelivery(input) {
          return Promise.resolve({
            isDuplicate: true,
            delivery: {
              id: "webhook_delivery_1",
              shopId: input.shopId ?? null,
              topic: input.topic,
              deliveryId: input.deliveryId,
              processedAt: new Date("2026-05-22T12:00:00.000Z"),
              payloadHash: input.payloadHash,
            },
          });
        },
      },
    });

    expect(result.duplicate).toBe(true);
    expect(uninstallCalls).toBe(0);
  });

  it("handles uninstall webhooks for missing shops safely", async () => {
    const result = await processShopifyWebhook(webhookRequest(), {
      authenticateWebhook() {
        return Promise.resolve({
          shop: shop.shopDomain,
          topic: "app/uninstalled",
          webhookId: "delivery_1",
        });
      },
      shopRepository: {
        findByDomain() {
          return Promise.resolve(null);
        },
        markUninstalled() {
          return Promise.resolve(null);
        },
      },
      webhookDeliveryRepository: {
        recordDelivery(input) {
          return Promise.resolve({
            isDuplicate: false,
            delivery: {
              id: "webhook_delivery_1",
              shopId: input.shopId ?? null,
              topic: input.topic,
              deliveryId: input.deliveryId,
              processedAt: new Date("2026-05-22T12:00:00.000Z"),
              payloadHash: input.payloadHash,
            },
          });
        },
      },
    });

    expect(result.delivery.shopId).toBeNull();
    expect(result.handled).toBe(true);
  });
});
