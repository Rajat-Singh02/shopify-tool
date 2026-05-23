import { describe, expect, it, vi } from "vitest";

import { AnalyticsEventRepository } from "./analytics-event-repository";

describe("AnalyticsEventRepository", () => {
  it("creates analytics events without visitor/session identifiers", async () => {
    const now = new Date("2026-05-23T00:00:00.000Z");
    const create = vi.fn().mockResolvedValue({
      id: "event_1",
      shopId: "shop_1",
      widgetId: "widget_1",
      videoId: "video_1",
      tagId: "tag_1",
      eventType: "PRODUCT_CLICKED",
      anonymousVisitorId: null,
      sessionId: null,
      occurredAt: now,
      metadataJson: {
        source: "widget",
      },
    });
    const repository = new AnalyticsEventRepository({
      analyticsEvent: {
        create,
        findMany: vi.fn(),
      },
    });

    await expect(
      repository.create({
        shopId: "shop_1",
        widgetId: "widget_1",
        videoId: "video_1",
        tagId: "tag_1",
        eventType: "PRODUCT_CLICKED",
        metadataJson: {
          source: "widget",
        },
      }),
    ).resolves.toMatchObject({
      id: "event_1",
      anonymousVisitorId: null,
      sessionId: null,
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String) as string,
        shopId: "shop_1",
        widgetId: "widget_1",
        videoId: "video_1",
        tagId: "tag_1",
        eventType: "PRODUCT_CLICKED",
        anonymousVisitorId: null,
        sessionId: null,
        metadataJson: {
          source: "widget",
        },
      },
    });
  });

  it("lists admin analytics events with safe relation includes and cursor pagination", async () => {
    const now = new Date("2026-05-23T00:00:00.000Z");
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "event_1",
        shopId: "shop_1",
        widgetId: "widget_1",
        videoId: "video_1",
        tagId: "tag_1",
        eventType: "WIDGET_VIEWED",
        anonymousVisitorId: null,
        sessionId: null,
        occurredAt: now,
        metadataJson: {},
        widget: {
          name: "Homepage widget",
        },
        video: {
          originalFilename: "demo.mp4",
        },
        tag: {
          shopifyProductId: "gid://shopify/Product/1",
          shopifyVariantId: "gid://shopify/ProductVariant/1",
        },
      },
      {
        id: "event_2",
        shopId: "shop_1",
        widgetId: "widget_1",
        videoId: "video_1",
        tagId: "tag_1",
        eventType: "WIDGET_VIEWED",
        anonymousVisitorId: null,
        sessionId: null,
        occurredAt: now,
        metadataJson: {},
        widget: null,
        video: null,
        tag: null,
      },
    ]);
    const repository = new AnalyticsEventRepository({
      analyticsEvent: {
        create: vi.fn(),
        findMany,
      },
    });

    await expect(
      repository.listForAdmin({
        shopId: "shop_1",
        first: 1,
        after: "event_0",
        eventType: "WIDGET_VIEWED",
        widgetId: "widget_1",
        videoId: "video_1",
        occurredAtFrom: new Date("2026-05-01T00:00:00.000Z"),
        occurredAtTo: now,
      }),
    ).resolves.toEqual({
      events: [
        expect.objectContaining({
          id: "event_1",
          widget: {
            name: "Homepage widget",
          },
        }),
      ],
      pageInfo: {
        hasNextPage: true,
        endCursor: "event_1",
      },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        shopId: "shop_1",
        eventType: "WIDGET_VIEWED",
        widgetId: "widget_1",
        videoId: "video_1",
        occurredAt: {
          gte: new Date("2026-05-01T00:00:00.000Z"),
          lte: now,
        },
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 2,
      cursor: {
        id: "event_0",
      },
      skip: 1,
      include: {
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
      },
    });
  });

  it("lists summary events scoped to shop and date range", async () => {
    const now = new Date("2026-05-23T00:00:00.000Z");
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new AnalyticsEventRepository({
      analyticsEvent: {
        create: vi.fn(),
        findMany,
      },
    });

    await repository.listForSummary({
      shopId: "shop_1",
      eventType: null,
      widgetId: null,
      videoId: null,
      occurredAtFrom: new Date("2026-05-01T00:00:00.000Z"),
      occurredAtTo: now,
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        shopId: "shop_1",
        occurredAt: {
          gte: new Date("2026-05-01T00:00:00.000Z"),
          lte: now,
        },
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 5000,
      include: {
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
      },
    });
  });
});
