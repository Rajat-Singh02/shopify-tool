import { describe, expect, it, vi } from "vitest";

import type { AdminAnalyticsEventRecord } from "@shoppable-video/db";

import {
  getAdminAnalyticsSummary,
  listAdminAnalyticsEvents,
  AdminAnalyticsExpectedError,
} from "../../server/api/admin-analytics";

const now = new Date("2026-05-23T00:00:00.000Z");
const shop = {
  id: "shop_1",
  shopDomain: "test-shop.myshopify.com",
};

function createEvent(overrides: Partial<AdminAnalyticsEventRecord> = {}): AdminAnalyticsEventRecord {
  return {
    id: "event_1",
    shopId: "shop_1",
    widgetId: "widget_1",
    videoId: "video_1",
    tagId: "tag_1",
    eventType: "WIDGET_VIEWED",
    anonymousVisitorId: null,
    sessionId: null,
    occurredAt: now,
    metadataJson: {
      storefrontEventType: "WIDGET_VIEW",
    },
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
    ...overrides,
  };
}

function createRepositories(events: AdminAnalyticsEventRecord[]) {
  return {
    analyticsEventRepository: {
      listForSummary: vi.fn().mockResolvedValue(events),
      listForAdmin: vi.fn().mockResolvedValue({
        events,
        pageInfo: {
          hasNextPage: true,
          endCursor: "event_2",
        },
      }),
    },
    widgetRepository: {
      findByShop: vi.fn().mockResolvedValue({
        id: "widget_1",
      }),
    },
    videoRepository: {
      findByShop: vi.fn().mockResolvedValue({
        id: "video_1",
      }),
    },
  };
}

describe("admin analytics service", () => {
  it("summarizes current-shop storefront event activity", async () => {
    const repositories = createRepositories([
      createEvent({ id: "event_1", metadataJson: { storefrontEventType: "WIDGET_VIEW" } }),
      createEvent({
        id: "event_2",
        eventType: "WIDGET_VIEWED",
        metadataJson: { storefrontEventType: "VIDEO_IMPRESSION" },
      }),
      createEvent({
        id: "event_3",
        eventType: "VIDEO_PLAYED",
        metadataJson: { storefrontEventType: "VIDEO_PLAY" },
      }),
      createEvent({
        id: "event_4",
        eventType: "VIDEO_PLAYED",
        metadataJson: { storefrontEventType: "VIDEO_PAUSE" },
      }),
      createEvent({
        id: "event_5",
        eventType: "PRODUCT_CLICKED",
        metadataJson: { storefrontEventType: "PRODUCT_CLICK" },
      }),
    ]);

    const result = await getAdminAnalyticsSummary({
      shop,
      query: {
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-23T00:00:00.000Z",
      },
      ...repositories,
      now,
    });

    expect(result.totals).toEqual({
      events: 5,
      widgetViews: 1,
      videoImpressions: 1,
      videoPlays: 1,
      videoPauses: 1,
      productClicks: 1,
    });
    expect(result.byEventType).toContainEqual({
      eventType: "PRODUCT_CLICK",
      count: 1,
    });
    expect(result.byWidget).toEqual([
      {
        widgetId: "widget_1",
        title: "Homepage widget",
        count: 5,
      },
    ]);
    expect(result.byVideo).toEqual([
      {
        videoId: "video_1",
        originalFilename: "demo.mp4",
        count: 5,
      },
    ]);
    expect(repositories.analyticsEventRepository.listForSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        shopId: "shop_1",
      }),
    );
  });

  it("supports date ranges and widget/video ownership filters", async () => {
    const repositories = createRepositories([createEvent()]);

    await getAdminAnalyticsSummary({
      shop,
      query: {
        widgetId: "widget_1",
        videoId: "video_1",
        eventType: "WIDGET_VIEW",
      },
      ...repositories,
      now,
    });

    expect(repositories.widgetRepository.findByShop).toHaveBeenCalledWith("shop_1", "widget_1");
    expect(repositories.videoRepository.findByShop).toHaveBeenCalledWith("shop_1", "video_1");
    expect(repositories.analyticsEventRepository.listForSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "WIDGET_VIEWED",
        widgetId: "widget_1",
        videoId: "video_1",
        occurredAtFrom: new Date("2026-04-23T00:00:00.000Z"),
        occurredAtTo: now,
      }),
    );
  });

  it("rejects invalid date ranges and wrong-shop filters safely", async () => {
    const repositories = createRepositories([]);

    await expect(
      getAdminAnalyticsSummary({
        shop,
        query: {
          from: "2026-05-24T00:00:00.000Z",
          to: "2026-05-23T00:00:00.000Z",
        },
        ...repositories,
        now,
      }),
    ).rejects.toBeInstanceOf(AdminAnalyticsExpectedError);

    await expect(
      getAdminAnalyticsSummary({
        shop,
        query: {
          widgetId: "bad/widget",
        },
        ...repositories,
        now,
      }),
    ).rejects.toMatchObject({
      status: 400,
    });

    await expect(
      getAdminAnalyticsSummary({
        shop,
        query: {
          widgetId: "missing_widget",
        },
        ...repositories,
        widgetRepository: {
          findByShop: vi.fn().mockResolvedValue(null),
        },
        now,
      }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it("lists safe event DTOs with pagination and no raw metadata", async () => {
    const repositories = createRepositories([
      createEvent({
        id: "event_1",
        metadataJson: {
          storefrontEventType: "PRODUCT_CLICK",
          rawCookie: "cookie-value",
        },
        eventType: "PRODUCT_CLICKED",
      }),
    ]);

    const result = await listAdminAnalyticsEvents({
      shop,
      query: {
        first: "80",
        after: "event_0",
        eventType: "PRODUCT_CLICK",
      },
      ...repositories,
      now,
    });
    const serialized = JSON.stringify(result);

    expect(result.events).toEqual([
      {
        id: "event_1",
        eventType: "PRODUCT_CLICK",
        widgetId: "widget_1",
        videoId: "video_1",
        productId: "gid://shopify/Product/1",
        variantId: "gid://shopify/ProductVariant/1",
        createdAt: "2026-05-23T00:00:00.000Z",
      },
    ]);
    expect(result.pageInfo).toEqual({
      hasNextPage: true,
      endCursor: "event_2",
    });
    expect(repositories.analyticsEventRepository.listForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        first: 50,
        after: "event_0",
        eventType: "PRODUCT_CLICKED",
      }),
    );
    expect(serialized).not.toContain("rawCookie");
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain("Authorization");
    expect(serialized).not.toContain("Cookie");
  });
});
