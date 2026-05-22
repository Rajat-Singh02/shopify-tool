import { describe, expect, it } from "vitest";

import {
  WebhookDeliveryRepository,
  type WebhookDeliveryRecord,
  type WebhookDeliveryRepositoryClient,
} from "./webhook-delivery-repository";

function createClient(): {
  client: WebhookDeliveryRepositoryClient;
  records: Map<string, WebhookDeliveryRecord>;
} {
  const records = new Map<string, WebhookDeliveryRecord>();

  return {
    records,
    client: {
      webhookDelivery: {
        create({ data }) {
          if (records.has(data.deliveryId)) {
            return Promise.reject(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
          }

          const record: WebhookDeliveryRecord = {
            id: `delivery_${records.size + 1}`,
            shopId: data.shopId ?? null,
            topic: data.topic,
            deliveryId: data.deliveryId,
            processedAt: data.processedAt ?? new Date("2026-05-22T00:00:00.000Z"),
            payloadHash: data.payloadHash,
          };

          records.set(data.deliveryId, record);

          return Promise.resolve(record);
        },
        findUnique({ where }) {
          return Promise.resolve(records.get(where.deliveryId) ?? null);
        },
      },
    },
  };
}

describe("WebhookDeliveryRepository", () => {
  it("records the first delivery", async () => {
    const { client } = createClient();
    const repository = new WebhookDeliveryRepository(client);

    const result = await repository.recordDelivery({
      shopId: "shop_1",
      topic: "app/uninstalled",
      deliveryId: "delivery_1",
      payloadHash: "hash",
    });

    expect(result.isDuplicate).toBe(false);
    expect(result.delivery.deliveryId).toBe("delivery_1");
  });

  it("treats duplicate delivery IDs as already processed", async () => {
    const { client } = createClient();
    const repository = new WebhookDeliveryRepository(client);
    const input = {
      shopId: "shop_1",
      topic: "app/uninstalled",
      deliveryId: "delivery_1",
      payloadHash: "hash",
    };

    await repository.recordDelivery(input);
    const duplicate = await repository.recordDelivery(input);

    expect(duplicate.isDuplicate).toBe(true);
    expect(duplicate.delivery.deliveryId).toBe(input.deliveryId);
  });
});
