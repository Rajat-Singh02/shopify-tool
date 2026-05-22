import { describe, expect, it } from "vitest";

import { handleWebhookAction } from "../routes/webhooks";

const shop = {
  id: "shop_1",
  shopDomain: "test-shop.myshopify.com",
  installedAt: new Date("2026-05-22T00:00:00.000Z"),
  uninstalledAt: null,
  createdAt: new Date("2026-05-22T00:00:00.000Z"),
  updatedAt: new Date("2026-05-22T00:00:00.000Z"),
};

describe("webhook route", () => {
  it("returns success for a valid webhook", async () => {
    const response = await handleWebhookAction(new Request("https://app.example.test/webhooks"), {
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
        markUninstalled() {
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

    await expect(response.json()).resolves.toEqual({
      ok: true,
      duplicate: false,
      handled: true,
    });
  });

  it("returns Shopify helper unauthorized responses for invalid webhooks", async () => {
    const response = await handleWebhookAction(new Request("https://app.example.test/webhooks"), {
      authenticateWebhook() {
        // This simulates the Shopify helper, which throws Response objects for auth failures.
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject(new Response(undefined, { status: 401 }));
      },
      shopRepository: {
        findByDomain() {
          return Promise.resolve(shop);
        },
        markUninstalled() {
          return Promise.resolve(shop);
        },
      },
      webhookDeliveryRepository: {
        recordDelivery() {
          throw new Error("should not be called");
        },
      },
    });

    expect(response.status).toBe(401);
  });
});
