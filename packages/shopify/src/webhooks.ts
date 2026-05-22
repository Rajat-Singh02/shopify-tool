import { createHash } from "node:crypto";

export const ShopifyWebhookTopic = {
  AppUninstalled: "app/uninstalled",
} as const;

export type ShopifyWebhookTopic =
  (typeof ShopifyWebhookTopic)[keyof typeof ShopifyWebhookTopic];

export function normalizeShopifyWebhookTopic(topic: string): string {
  return topic.toLowerCase().replaceAll("_", "/");
}

export function isAppUninstalledTopic(topic: string): boolean {
  return normalizeShopifyWebhookTopic(topic) === ShopifyWebhookTopic.AppUninstalled;
}

export function createWebhookPayloadHash(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}
