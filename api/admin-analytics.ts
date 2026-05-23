import type {
  AdminAnalyticsEventRecord,
  AnalyticsEventRepository,
  AnalyticsEventType,
  VideoRepository,
  WidgetRepository,
} from "@shoppable-video/db";

import type { VideoUploadShop } from "./video-upload.js";

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_ID_LENGTH = 160;

const STOREFRONT_EVENT_TYPES = new Set<AdminAnalyticsEventType>([
  "WIDGET_VIEW",
  "VIDEO_IMPRESSION",
  "VIDEO_PLAY",
  "VIDEO_PAUSE",
  "PRODUCT_CLICK",
]);

export type AdminAnalyticsEventType =
  | "WIDGET_VIEW"
  | "VIDEO_IMPRESSION"
  | "VIDEO_PLAY"
  | "VIDEO_PAUSE"
  | "PRODUCT_CLICK";

export type AdminAnalyticsSummaryResponse = {
  range: {
    from: string;
    to: string;
  };
  totals: {
    events: number;
    widgetViews: number;
    videoImpressions: number;
    videoPlays: number;
    videoPauses: number;
    productClicks: number;
  };
  byEventType: Array<{
    eventType: AdminAnalyticsEventType;
    count: number;
  }>;
  byWidget: Array<{
    widgetId: string;
    title: string | null;
    count: number;
  }>;
  byVideo: Array<{
    videoId: string;
    originalFilename: string | null;
    count: number;
  }>;
};

export type AdminAnalyticsEventsResponse = {
  events: SafeAdminAnalyticsEventDto[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
};

export type SafeAdminAnalyticsEventDto = {
  id: string;
  eventType: AdminAnalyticsEventType;
  widgetId: string | null;
  videoId: string | null;
  productId: string | null;
  variantId: string | null;
  createdAt: string;
};

export type AdminAnalyticsQuery = {
  first?: unknown;
  after?: unknown;
  from?: unknown;
  to?: unknown;
  eventType?: unknown;
  widgetId?: unknown;
  videoId?: unknown;
};

type ParsedAdminAnalyticsQuery = {
  first: number;
  after: string | null;
  from: Date;
  to: Date;
  eventType: AdminAnalyticsEventType | null;
  widgetId: string | null;
  videoId: string | null;
};

export class AdminAnalyticsExpectedError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly clientMessage = message,
  ) {
    super(message);
    this.name = "AdminAnalyticsExpectedError";
  }
}

export async function getAdminAnalyticsSummary({
  shop,
  query,
  analyticsEventRepository,
  widgetRepository,
  videoRepository,
  now = new Date(),
}: {
  shop: VideoUploadShop;
  query: AdminAnalyticsQuery;
  analyticsEventRepository: Pick<AnalyticsEventRepository, "listForSummary">;
  widgetRepository: Pick<WidgetRepository, "findByShop">;
  videoRepository: Pick<VideoRepository, "findByShop">;
  now?: Date;
}): Promise<AdminAnalyticsSummaryResponse> {
  const input = parseAdminAnalyticsQuery(query, now);
  await validateOwnedFilters({
    shop,
    widgetId: input.widgetId,
    videoId: input.videoId,
    widgetRepository,
    videoRepository,
  });

  const events = filterByStorefrontEventType(
    await analyticsEventRepository.listForSummary({
      shopId: shop.id,
      eventType: input.eventType ? mapAdminEventTypeToDatabase(input.eventType) : null,
      widgetId: input.widgetId,
      videoId: input.videoId,
      occurredAtFrom: input.from,
      occurredAtTo: input.to,
    }),
    input.eventType,
  );

  return {
    range: {
      from: input.from.toISOString(),
      to: input.to.toISOString(),
    },
    totals: summarizeTotals(events),
    byEventType: summarizeByEventType(events),
    byWidget: summarizeByWidget(events),
    byVideo: summarizeByVideo(events),
  };
}

export async function listAdminAnalyticsEvents({
  shop,
  query,
  analyticsEventRepository,
  widgetRepository,
  videoRepository,
  now = new Date(),
}: {
  shop: VideoUploadShop;
  query: AdminAnalyticsQuery;
  analyticsEventRepository: Pick<AnalyticsEventRepository, "listForAdmin">;
  widgetRepository: Pick<WidgetRepository, "findByShop">;
  videoRepository: Pick<VideoRepository, "findByShop">;
  now?: Date;
}): Promise<AdminAnalyticsEventsResponse> {
  const input = parseAdminAnalyticsQuery(query, now);
  await validateOwnedFilters({
    shop,
    widgetId: input.widgetId,
    videoId: input.videoId,
    widgetRepository,
    videoRepository,
  });

  const result = await analyticsEventRepository.listForAdmin({
    shopId: shop.id,
    first: input.first,
    after: input.after,
    eventType: input.eventType ? mapAdminEventTypeToDatabase(input.eventType) : null,
    widgetId: input.widgetId,
    videoId: input.videoId,
    occurredAtFrom: input.from,
    occurredAtTo: input.to,
  });
  const events = filterByStorefrontEventType(result.events, input.eventType);

  return {
    events: events.map(toSafeAdminAnalyticsEventDto),
    pageInfo: result.pageInfo,
  };
}

function parseAdminAnalyticsQuery(
  query: AdminAnalyticsQuery,
  now: Date,
): ParsedAdminAnalyticsQuery {
  const to = parseDate(query.to, "to") ?? now;
  const from =
    parseDate(query.from, "from") ??
    new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  const maxFrom = new Date(to.getTime() - MAX_RANGE_DAYS * 24 * 60 * 60 * 1000);

  if (from.getTime() > to.getTime()) {
    throw new AdminAnalyticsExpectedError("from must be before to", 400);
  }

  return {
    first: parseFirst(query.first),
    after: parseCursor(query.after),
    from: from < maxFrom ? maxFrom : from,
    to,
    eventType: parseEventType(query.eventType),
    widgetId: parseOptionalId(query.widgetId, "widgetId"),
    videoId: parseOptionalId(query.videoId, "videoId"),
  };
}

function parseDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new AdminAnalyticsExpectedError(`${field} date is invalid`, 400);
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new AdminAnalyticsExpectedError(`${field} date is invalid`, 400);
  }

  return date;
}

function parseFirst(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_PAGE_SIZE;
  }

  const first = Number(value);

  if (!Number.isInteger(first) || first <= 0) {
    throw new AdminAnalyticsExpectedError("first must be a positive integer", 400);
  }

  return Math.min(first, MAX_PAGE_SIZE);
}

function parseCursor(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return validateId(value, "after");
}

function parseEventType(value: unknown): AdminAnalyticsEventType | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || !STOREFRONT_EVENT_TYPES.has(value as AdminAnalyticsEventType)) {
    throw new AdminAnalyticsExpectedError("eventType is invalid", 400);
  }

  return value as AdminAnalyticsEventType;
}

function parseOptionalId(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return validateId(value, field);
}

function validateId(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new AdminAnalyticsExpectedError(`${field} is invalid`, 400);
  }

  const id = value.trim();

  if (id.length === 0 || id.length > MAX_ID_LENGTH || /[/"'<>\\\s]/.test(id)) {
    throw new AdminAnalyticsExpectedError(`${field} is invalid`, 400);
  }

  return id;
}

async function validateOwnedFilters({
  shop,
  widgetId,
  videoId,
  widgetRepository,
  videoRepository,
}: {
  shop: VideoUploadShop;
  widgetId: string | null;
  videoId: string | null;
  widgetRepository: Pick<WidgetRepository, "findByShop">;
  videoRepository: Pick<VideoRepository, "findByShop">;
}): Promise<void> {
  if (widgetId) {
    const widget = await widgetRepository.findByShop(shop.id, widgetId);

    if (!widget) {
      throw new AdminAnalyticsExpectedError("Widget was not found", 404);
    }
  }

  if (videoId) {
    const video = await videoRepository.findByShop(shop.id, videoId);

    if (!video) {
      throw new AdminAnalyticsExpectedError("Video was not found", 404);
    }
  }
}

function summarizeTotals(events: AdminAnalyticsEventRecord[]): AdminAnalyticsSummaryResponse["totals"] {
  const counts = countByEventType(events);

  return {
    events: events.length,
    widgetViews: counts.WIDGET_VIEW,
    videoImpressions: counts.VIDEO_IMPRESSION,
    videoPlays: counts.VIDEO_PLAY,
    videoPauses: counts.VIDEO_PAUSE,
    productClicks: counts.PRODUCT_CLICK,
  };
}

function summarizeByEventType(
  events: AdminAnalyticsEventRecord[],
): AdminAnalyticsSummaryResponse["byEventType"] {
  const counts = countByEventType(events);

  return Array.from(STOREFRONT_EVENT_TYPES, (eventType) => ({
    eventType,
    count: counts[eventType],
  }));
}

function summarizeByWidget(
  events: AdminAnalyticsEventRecord[],
): AdminAnalyticsSummaryResponse["byWidget"] {
  const groups = new Map<string, { title: string | null; count: number }>();

  for (const event of events) {
    if (!event.widgetId) {
      continue;
    }

    const current = groups.get(event.widgetId);
    groups.set(event.widgetId, {
      title: current?.title ?? event.widget?.name ?? null,
      count: (current?.count ?? 0) + 1,
    });
  }

  return Array.from(groups, ([widgetId, value]) => ({
    widgetId,
    title: value.title,
    count: value.count,
  }));
}

function summarizeByVideo(
  events: AdminAnalyticsEventRecord[],
): AdminAnalyticsSummaryResponse["byVideo"] {
  const groups = new Map<string, { originalFilename: string | null; count: number }>();

  for (const event of events) {
    if (!event.videoId) {
      continue;
    }

    const current = groups.get(event.videoId);
    groups.set(event.videoId, {
      originalFilename: current?.originalFilename ?? event.video?.originalFilename ?? null,
      count: (current?.count ?? 0) + 1,
    });
  }

  return Array.from(groups, ([videoId, value]) => ({
    videoId,
    originalFilename: value.originalFilename,
    count: value.count,
  }));
}

function countByEventType(events: AdminAnalyticsEventRecord[]): Record<AdminAnalyticsEventType, number> {
  const counts: Record<AdminAnalyticsEventType, number> = {
    WIDGET_VIEW: 0,
    VIDEO_IMPRESSION: 0,
    VIDEO_PLAY: 0,
    VIDEO_PAUSE: 0,
    PRODUCT_CLICK: 0,
  };

  for (const event of events) {
    counts[toAdminAnalyticsEventType(event)] += 1;
  }

  return counts;
}

function filterByStorefrontEventType(
  events: AdminAnalyticsEventRecord[],
  eventType: AdminAnalyticsEventType | null,
): AdminAnalyticsEventRecord[] {
  if (!eventType) {
    return events;
  }

  return events.filter((event) => toAdminAnalyticsEventType(event) === eventType);
}

function toSafeAdminAnalyticsEventDto(event: AdminAnalyticsEventRecord): SafeAdminAnalyticsEventDto {
  return {
    id: event.id,
    eventType: toAdminAnalyticsEventType(event),
    widgetId: event.widgetId,
    videoId: event.videoId,
    productId: event.tag?.shopifyProductId ?? null,
    variantId: event.tag?.shopifyVariantId ?? null,
    createdAt: event.occurredAt.toISOString(),
  };
}

function toAdminAnalyticsEventType(event: AdminAnalyticsEventRecord): AdminAnalyticsEventType {
  const metadataEventType = getStorefrontEventTypeFromMetadata(event.metadataJson);

  if (metadataEventType) {
    return metadataEventType;
  }

  if (event.eventType === "PRODUCT_CLICKED") {
    return "PRODUCT_CLICK";
  }

  if (event.eventType === "VIDEO_PLAYED" || event.eventType === "VIDEO_COMPLETED") {
    return "VIDEO_PLAY";
  }

  return "WIDGET_VIEW";
}

function getStorefrontEventTypeFromMetadata(metadataJson: unknown): AdminAnalyticsEventType | null {
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) {
    return null;
  }

  const eventType = (metadataJson as Record<string, unknown>).storefrontEventType;

  return typeof eventType === "string" && STOREFRONT_EVENT_TYPES.has(eventType as AdminAnalyticsEventType)
    ? (eventType as AdminAnalyticsEventType)
    : null;
}

function mapAdminEventTypeToDatabase(eventType: AdminAnalyticsEventType): AnalyticsEventType {
  if (eventType === "PRODUCT_CLICK") {
    return "PRODUCT_CLICKED";
  }

  if (eventType === "VIDEO_PLAY" || eventType === "VIDEO_PAUSE") {
    return "VIDEO_PLAYED";
  }

  return "WIDGET_VIEWED";
}
