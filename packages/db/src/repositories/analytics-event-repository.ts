import { randomUUID } from "node:crypto";

export type AnalyticsEventType =
  | "WIDGET_VIEWED"
  | "VIDEO_PLAYED"
  | "VIDEO_COMPLETED"
  | "PRODUCT_CLICKED"
  | "ADD_TO_CART_CLICKED"
  | "ADD_TO_CART_SUCCEEDED"
  | "ADD_TO_CART_FAILED";

export type AnalyticsEventRecord = {
  id: string;
  shopId: string;
  widgetId: string | null;
  videoId: string | null;
  tagId: string | null;
  eventType: AnalyticsEventType;
  anonymousVisitorId: string | null;
  sessionId: string | null;
  occurredAt: Date;
  metadataJson: unknown;
};

export type AnalyticsMetadataValue = string | number | boolean | null;

export type CreateAnalyticsEventInput = {
  shopId: string;
  widgetId: string | null;
  videoId: string | null;
  tagId: string | null;
  eventType: AnalyticsEventType;
  metadataJson: Record<string, AnalyticsMetadataValue> | null;
};

export type AnalyticsEventRepositoryClient = {
  analyticsEvent: {
    create(args: {
      data: {
        id: string;
        shopId: string;
        widgetId: string | null;
        videoId: string | null;
        tagId: string | null;
        eventType: AnalyticsEventType;
        anonymousVisitorId: null;
        sessionId: null;
        metadataJson?: Record<string, AnalyticsMetadataValue>;
      };
    }): Promise<AnalyticsEventRecord>;
  };
};

export class AnalyticsEventRepository {
  constructor(private readonly client: AnalyticsEventRepositoryClient) {}

  async create(input: CreateAnalyticsEventInput): Promise<AnalyticsEventRecord> {
    return this.client.analyticsEvent.create({
      data: {
        id: randomUUID(),
        shopId: input.shopId,
        widgetId: input.widgetId,
        videoId: input.videoId,
        tagId: input.tagId,
        eventType: input.eventType,
        anonymousVisitorId: null,
        sessionId: null,
        ...(input.metadataJson ? { metadataJson: input.metadataJson } : {}),
      },
    });
  }
}
