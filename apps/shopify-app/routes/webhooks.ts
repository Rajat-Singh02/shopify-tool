import { getPrismaClient, ShopRepository, WebhookDeliveryRepository } from "@shoppable-video/db";

import { serializeError } from "../lib/errors";
import { logger } from "../lib/logger";
import {
  processShopifyWebhook,
  type WebhookServiceDependencies,
} from "../services/webhooks.server";

export type WebhookActionArgs = {
  request: Request;
};

export async function handleWebhookAction(
  request: Request,
  dependencies: WebhookServiceDependencies,
): Promise<Response> {
  try {
    const result = await processShopifyWebhook(request, dependencies);

    logger.info(
      {
        topic: result.topic,
        shopDomain: result.shopDomain,
        deliveryId: result.delivery.deliveryId,
        duplicate: result.duplicate,
        handled: result.handled,
      },
      "Processed Shopify webhook",
    );

    return Response.json({
      ok: true,
      duplicate: result.duplicate,
      handled: result.handled,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    logger.error({ error: serializeError(error) }, "Failed to process Shopify webhook");

    return Response.json(serializeError(error), { status: 500 });
  }
}

export async function action({ request }: WebhookActionArgs): Promise<Response> {
  const prisma = getPrismaClient();

  return handleWebhookAction(request, {
    shopRepository: new ShopRepository(prisma),
    webhookDeliveryRepository: new WebhookDeliveryRepository(prisma),
  });
}
