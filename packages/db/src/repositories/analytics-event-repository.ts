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

export type AdminAnalyticsEventRecord = AnalyticsEventRecord & {
  widget: {
    name: string;
  } | null;
  video: {
    originalFilename: string;
  } | null;
  tag: {
    shopifyProductId: string;
    shopifyVariantId: string;
  } | null;
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

export type ListAdminAnalyticsEventsInput = {
  shopId: string;
  first: number;
  after?: string | null;
  eventType?: AnalyticsEventType | null;
  widgetId?: string | null;
  videoId?: string | null;
  occurredAtFrom: Date;
  occurredAtTo: Date;
};

export type ListAdminAnalyticsEventsResult = {
  events: AdminAnalyticsEventRecord[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
};

export type AdminAnalyticsSummaryInput = Omit<ListAdminAnalyticsEventsInput, "first" | "after">;

type AnalyticsEventWhereInput = {
  shopId: string;
  eventType?: AnalyticsEventType;
  widgetId?: string;
  videoId?: string;
  occurredAt: {
    gte: Date;
    lte: Date;
  };
};

type AdminAnalyticsEventInclude = {
  widget: {
    select: {
      name: true;
    };
  };
  video: {
    select: {
      originalFilename: true;
    };
  };
  tag: {
    select: {
      shopifyProductId: true;
      shopifyVariantId: true;
    };
  };
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
    findMany(args: {
      where: AnalyticsEventWhereInput;
      orderBy: Array<{ occurredAt: "desc" } | { id: "desc" }>;
      take?: number;
      skip?: number;
      cursor?: {
        id: string;
      };
      include: AdminAnalyticsEventInclude;
    }): Promise<AdminAnalyticsEventRecord[]>;
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

  async listForAdmin(
    input: ListAdminAnalyticsEventsInput,
  ): Promise<ListAdminAnalyticsEventsResult> {
    const events = await this.client.analyticsEvent.findMany({
      where: createAnalyticsEventWhere(input),
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: input.first + 1,
      ...(input.after
        ? {
            cursor: {
              id: input.after,
            },
            skip: 1,
          }
        : {}),
      include: createAdminAnalyticsEventInclude(),
    });
    const visibleEvents = events.slice(0, input.first);
    const lastEvent = visibleEvents.at(-1);

    return {
      events: visibleEvents,
      pageInfo: {
        hasNextPage: events.length > input.first,
        endCursor: lastEvent ? lastEvent.id : null,
      },
    };
  }

  async listForSummary(input: AdminAnalyticsSummaryInput): Promise<AdminAnalyticsEventRecord[]> {
    return this.client.analyticsEvent.findMany({
      where: createAnalyticsEventWhere(input),
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      include: createAdminAnalyticsEventInclude(),
    });
  }
}

function createAnalyticsEventWhere(input: AdminAnalyticsSummaryInput): AnalyticsEventWhereInput {
  return {
    shopId: input.shopId,
    ...(input.eventType ? { eventType: input.eventType } : {}),
    ...(input.widgetId ? { widgetId: input.widgetId } : {}),
    ...(input.videoId ? { videoId: input.videoId } : {}),
    occurredAt: {
      gte: input.occurredAtFrom,
      lte: input.occurredAtTo,
    },
  };
}

function createAdminAnalyticsEventInclude(): AdminAnalyticsEventInclude {
  return {
    widget: {
      select: {
        name: true,
      },
    },
    video: {
      select: {
        originalFilename: true,
      },
    },
    tag: {
      select: {
        shopifyProductId: true,
        shopifyVariantId: true,
      },
    },
  };
}
