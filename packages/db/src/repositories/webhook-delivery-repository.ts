export type WebhookDeliveryRecord = {
  id: string;
  shopId: string | null;
  topic: string;
  deliveryId: string;
  processedAt: Date;
  payloadHash: string;
};

export type WebhookDeliveryRepositoryClient = {
  webhookDelivery: {
    create(args: {
      data: {
        shopId?: string | null;
        topic: string;
        deliveryId: string;
        payloadHash: string;
        processedAt?: Date;
      };
    }): Promise<WebhookDeliveryRecord>;
    findUnique(args: { where: { deliveryId: string } }): Promise<WebhookDeliveryRecord | null>;
  };
};

export type RecordWebhookDeliveryInput = {
  shopId?: string | null;
  topic: string;
  deliveryId: string;
  payloadHash: string;
  processedAt?: Date;
};

export type RecordWebhookDeliveryResult = {
  delivery: WebhookDeliveryRecord;
  isDuplicate: boolean;
};

export class WebhookDeliveryRepository {
  constructor(private readonly client: WebhookDeliveryRepositoryClient) {}

  async recordDelivery(
    input: RecordWebhookDeliveryInput,
  ): Promise<RecordWebhookDeliveryResult> {
    try {
      const delivery = await this.client.webhookDelivery.create({
        data: {
          shopId: input.shopId ?? null,
          topic: input.topic,
          deliveryId: input.deliveryId,
          payloadHash: input.payloadHash,
          processedAt: input.processedAt,
        },
      });

      return {
        delivery,
        isDuplicate: false,
      };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const delivery = await this.client.webhookDelivery.findUnique({
        where: { deliveryId: input.deliveryId },
      });

      if (!delivery) {
        throw error;
      }

      return {
        delivery,
        isDuplicate: true,
      };
    }
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
