export type RepositoryContext = {
  shopId: string;
};

export class TenantScopeError extends Error {
  constructor(message = "A shop-scoped repository operation requires a shop ID") {
    super(message);
    this.name = "TenantScopeError";
  }
}

export function assertShopScope(context: RepositoryContext): string {
  if (!context.shopId) {
    throw new TenantScopeError();
  }

  return context.shopId;
}

export { createPrismaClient, getPrismaClient } from "./prisma.js";
export {
  AnalyticsEventRepository,
  type AnalyticsMetadataValue,
  type AnalyticsEventRecord,
  type AnalyticsEventRepositoryClient,
  type AnalyticsEventType,
  type CreateAnalyticsEventInput,
} from "./repositories/analytics-event-repository.js";
export {
  ShopRepository,
  type ShopRecord,
  type ShopRepositoryClient,
} from "./repositories/shop-repository.js";
export {
  WebhookDeliveryRepository,
  type RecordWebhookDeliveryInput,
  type RecordWebhookDeliveryResult,
  type WebhookDeliveryRecord,
  type WebhookDeliveryRepositoryClient,
} from "./repositories/webhook-delivery-repository.js";
export {
  VideoRepository,
  type CreateManualUploadVideoInput,
  type ListVideosInput,
  type ListVideosResult,
  type VideoRecord,
  type VideoRepositoryClient,
  type VideoSource,
  type VideoStatus,
} from "./repositories/video-repository.js";
export {
  VideoProductTagRepository,
  type UpsertVideoProductTagInput,
  type VideoProductTagRecord,
  type VideoProductTagRepositoryClient,
} from "./repositories/video-product-tag-repository.js";
export {
  WidgetRepository,
  type AdminWidgetRecord,
  type StorefrontWidgetRecord,
  type WidgetLayout,
  type WidgetRecord,
  type WidgetRepositoryClient,
  type WidgetStatus,
  type WidgetVideoRecord,
} from "./repositories/widget-repository.js";
export {
  PrismaShopifySessionStorage,
  type ShopifySessionRecord,
  type ShopifySessionStorageClient,
} from "./shopify-session-storage.js";
