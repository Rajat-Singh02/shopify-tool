import type {
  ShopRepository,
  WebhookDeliveryRepository,
  WebhookDeliveryRecord,
} from "@shoppable-video/db";
import {
  createWebhookPayloadHash,
  isAppUninstalledTopic,
  normalizeShopifyWebhookTopic,
} from "@shoppable-video/shopify";

import { authenticate } from "../app/lib/shopify.server";
import { markShopUninstalled } from "./shop-lifecycle.server";

export type ShopifyWebhookContext = {
  shop: string;
  topic: string;
  webhookId: string;
  eventId?: string;
};

export type ShopifyWebhookAuthenticator = (
  request: Request,
) => Promise<ShopifyWebhookContext>;

export type WebhookProcessResult = {
  delivery: WebhookDeliveryRecord;
  duplicate: boolean;
  topic: string;
  shopDomain: string;
  handled: boolean;
};

export type WebhookServiceDependencies = {
  authenticateWebhook?: ShopifyWebhookAuthenticator;
  shopRepository: Pick<ShopRepository, "findByDomain" | "markUninstalled">;
  webhookDeliveryRepository: Pick<WebhookDeliveryRepository, "recordDelivery">;
};

export async function processShopifyWebhook(
  request: Request,
  {
    authenticateWebhook = (webhookRequest) => authenticate.webhook(webhookRequest),
    shopRepository,
    webhookDeliveryRepository,
  }: WebhookServiceDependencies,
): Promise<WebhookProcessResult> {
  const rawBody = await request.clone().text();
  const webhook = await authenticateWebhook(request);
  const topic = normalizeShopifyWebhookTopic(webhook.topic);
  const shop = await shopRepository.findByDomain(webhook.shop);
  const deliveryId = webhook.webhookId || webhook.eventId;

  if (!deliveryId) {
    throw new Error("Shopify webhook delivery ID is missing");
  }

  const deliveryResult = await webhookDeliveryRepository.recordDelivery({
    shopId: shop?.id ?? null,
    topic,
    deliveryId,
    payloadHash: createWebhookPayloadHash(rawBody),
  });

  if (deliveryResult.isDuplicate) {
    return {
      delivery: deliveryResult.delivery,
      duplicate: true,
      topic,
      shopDomain: webhook.shop,
      handled: true,
    };
  }

  if (isAppUninstalledTopic(topic)) {
    await markShopUninstalled(webhook.shop, { shopRepository });

    return {
      delivery: deliveryResult.delivery,
      duplicate: false,
      topic,
      shopDomain: webhook.shop,
      handled: true,
    };
  }

  return {
    delivery: deliveryResult.delivery,
    duplicate: false,
    topic,
    shopDomain: webhook.shop,
    handled: false,
  };
}
