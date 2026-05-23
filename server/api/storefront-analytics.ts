import type {
  AnalyticsEventRepository,
  AnalyticsEventType,
  AnalyticsMetadataValue,
  StorefrontWidgetRecord,
  WidgetRepository,
} from "@shoppable-video/db";

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const PRODUCT_GID_PATTERN = /^gid:\/\/shopify\/Product\/[0-9]+$/;
const VARIANT_GID_PATTERN = /^gid:\/\/shopify\/ProductVariant\/[0-9]+$/;
const MAX_ID_LENGTH = 160;
const MAX_SHOP_DOMAIN_LENGTH = 255;
const MAX_METADATA_KEYS = 10;
const MAX_METADATA_STRING_LENGTH = 120;

const STOREFRONT_EVENT_TYPES = new Set<StorefrontAnalyticsEventType>([
  "WIDGET_VIEW",
  "VIDEO_IMPRESSION",
  "VIDEO_PLAY",
  "VIDEO_PAUSE",
  "PRODUCT_CLICK",
]);

export type StorefrontAnalyticsEventType =
  | "WIDGET_VIEW"
  | "VIDEO_IMPRESSION"
  | "VIDEO_PLAY"
  | "VIDEO_PAUSE"
  | "PRODUCT_CLICK";

export type StorefrontAnalyticsEventInput = {
  shop?: unknown;
  widgetId?: unknown;
  videoId?: unknown;
  eventType?: unknown;
  productId?: unknown;
  variantId?: unknown;
  metadata?: unknown;
};

export type StorefrontAnalyticsResponse = {
  ok: true;
};

export class StorefrontAnalyticsExpectedError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly clientMessage = message,
  ) {
    super(message);
    this.name = "StorefrontAnalyticsExpectedError";
  }
}

export async function ingestStorefrontAnalyticsEvent({
  input,
  widgetRepository,
  analyticsEventRepository,
}: {
  input: unknown;
  widgetRepository: Pick<WidgetRepository, "findPublishedStorefrontWidget">;
  analyticsEventRepository: Pick<AnalyticsEventRepository, "create">;
}): Promise<StorefrontAnalyticsResponse> {
  const event = parseStorefrontAnalyticsEvent(input);
  const widget = await widgetRepository.findPublishedStorefrontWidget(event.shop, event.widgetId);

  if (!widget) {
    throw new StorefrontAnalyticsExpectedError("Widget was not found", 404);
  }

  const matched = validateEventRelationships(widget, event);

  await analyticsEventRepository.create({
    shopId: widget.shopId,
    widgetId: widget.id,
    videoId: matched.videoId,
    tagId: matched.tagId,
    eventType: mapStorefrontEventType(event.eventType),
    metadataJson: {
      ...event.metadata,
      storefrontEventType: event.eventType,
    },
  });

  return {
    ok: true,
  };
}

export function parseStorefrontAnalyticsEvent(input: unknown): {
  shop: string;
  widgetId: string;
  videoId: string | null;
  eventType: StorefrontAnalyticsEventType;
  productId: string | null;
  variantId: string | null;
  metadata: Record<string, AnalyticsMetadataValue>;
} {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new StorefrontAnalyticsExpectedError("Request body must be an object", 400);
  }

  const record = input as StorefrontAnalyticsEventInput;
  const eventType = validateEventType(record.eventType);
  const productId = validateOptionalGid(record.productId, PRODUCT_GID_PATTERN, "productId");
  const variantId = validateOptionalGid(record.variantId, VARIANT_GID_PATTERN, "variantId");
  const videoId = validateOptionalId(record.videoId, "videoId");

  if ((eventType === "VIDEO_IMPRESSION" || eventType === "VIDEO_PLAY" || eventType === "VIDEO_PAUSE") && !videoId) {
    throw new StorefrontAnalyticsExpectedError("videoId is required for video events", 400);
  }

  if (eventType === "PRODUCT_CLICK" && (!videoId || !productId)) {
    throw new StorefrontAnalyticsExpectedError("videoId and productId are required for product clicks", 400);
  }

  if ((productId || variantId) && !videoId) {
    throw new StorefrontAnalyticsExpectedError("videoId is required with product or variant ids", 400);
  }

  return {
    shop: validateShopDomain(record.shop),
    widgetId: validateRequiredId(record.widgetId, "widgetId"),
    videoId,
    eventType,
    productId,
    variantId,
    metadata: sanitizeMetadata(record.metadata),
  };
}

function validateEventRelationships(
  widget: StorefrontWidgetRecord,
  event: ReturnType<typeof parseStorefrontAnalyticsEvent>,
): { videoId: string | null; tagId: string | null } {
  if (!event.videoId) {
    return {
      videoId: null,
      tagId: null,
    };
  }

  const widgetVideo = widget.widgetVideos.find(({ video }) => video.id === event.videoId);

  if (!widgetVideo || widgetVideo.video.status !== "READY") {
    throw new StorefrontAnalyticsExpectedError("Video was not found", 404);
  }

  if (!event.productId && !event.variantId) {
    return {
      videoId: widgetVideo.video.id,
      tagId: null,
    };
  }

  const tag = widgetVideo.video.productTags.find(
    (candidate) =>
      candidate.isActive &&
      candidate.shopifyProductId === event.productId &&
      (!event.variantId || candidate.shopifyVariantId === event.variantId),
  );

  if (!tag) {
    throw new StorefrontAnalyticsExpectedError("Product tag was not found", 404);
  }

  return {
    videoId: widgetVideo.video.id,
    tagId: tag.id,
  };
}

function mapStorefrontEventType(eventType: StorefrontAnalyticsEventType): AnalyticsEventType {
  if (eventType === "PRODUCT_CLICK") {
    return "PRODUCT_CLICKED";
  }

  if (eventType === "VIDEO_PLAY" || eventType === "VIDEO_PAUSE") {
    return "VIDEO_PLAYED";
  }

  return "WIDGET_VIEWED";
}

function validateShopDomain(value: unknown): string {
  if (typeof value !== "string") {
    throw new StorefrontAnalyticsExpectedError("shop is required", 400);
  }

  const shopDomain = value.trim().toLowerCase();

  if (
    shopDomain.length === 0 ||
    shopDomain.length > MAX_SHOP_DOMAIN_LENGTH ||
    !SHOP_DOMAIN_PATTERN.test(shopDomain)
  ) {
    throw new StorefrontAnalyticsExpectedError("shop is invalid", 400);
  }

  return shopDomain;
}

function validateEventType(value: unknown): StorefrontAnalyticsEventType {
  if (typeof value !== "string" || !STOREFRONT_EVENT_TYPES.has(value as StorefrontAnalyticsEventType)) {
    throw new StorefrontAnalyticsExpectedError("eventType is invalid", 400);
  }

  return value as StorefrontAnalyticsEventType;
}

function validateRequiredId(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new StorefrontAnalyticsExpectedError(`${field} is required`, 400);
  }

  const id = value.trim();

  if (id.length === 0 || id.length > MAX_ID_LENGTH || /[/"'<>\\\s]/.test(id)) {
    throw new StorefrontAnalyticsExpectedError(`${field} is invalid`, 400);
  }

  return id;
}

function validateOptionalId(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return validateRequiredId(value, field);
}

function validateOptionalGid(value: unknown, pattern: RegExp, field: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || value.length > MAX_ID_LENGTH || !pattern.test(value)) {
    throw new StorefrontAnalyticsExpectedError(`${field} is invalid`, 400);
  }

  return value;
}

function sanitizeMetadata(value: unknown): Record<string, AnalyticsMetadataValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const safeMetadata: Record<string, AnalyticsMetadataValue> = {};
  const metadataRecord = value as Record<string, unknown>;

  for (const [key, metadataValue] of Object.entries(metadataRecord).slice(0, MAX_METADATA_KEYS)) {
    if (!/^[a-zA-Z0-9_.-]{1,40}$/.test(key)) {
      continue;
    }

    const safeValue = toSafeMetadataValue(metadataValue);
    if (safeValue !== undefined) {
      safeMetadata[key] = safeValue;
    }
  }

  return safeMetadata;
}

function toSafeMetadataValue(value: unknown): AnalyticsMetadataValue | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return undefined;
    }

    return value;
  }

  if (typeof value === "string") {
    return value.slice(0, MAX_METADATA_STRING_LENGTH);
  }

  return undefined;
}
