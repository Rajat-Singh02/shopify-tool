import { describe, expect, it, vi } from "vitest";

import type { StorefrontWidgetRecord } from "@shoppable-video/db";

import {
  ingestStorefrontAnalyticsEvent,
  parseStorefrontAnalyticsEvent,
  StorefrontAnalyticsExpectedError,
} from "../../api/storefront-analytics";

const now = new Date("2026-05-23T00:00:00.000Z");

function createWidget(overrides: Partial<StorefrontWidgetRecord> = {}): StorefrontWidgetRecord {
  return {
    id: "widget_1",
    shopId: "shop_1",
    name: "Homepage videos",
    status: "PUBLISHED",
    layout: "INLINE_CAROUSEL",
    settingsJson: {},
    createdAt: now,
    updatedAt: now,
    shop: {
      shopDomain: "test-shop.myshopify.com",
    },
    widgetVideos: [
      {
        id: "widget_video_1",
        shopId: "shop_1",
        widgetId: "widget_1",
        videoId: "video_1",
        position: 0,
        createdAt: now,
        video: {
          id: "video_1",
          shopId: "shop_1",
          source: "MANUAL_UPLOAD",
          originalFilename: "demo.mp4",
          originalMimeType: "video/mp4",
          originalSizeBytes: 12n,
          status: "READY",
          storageKeyOriginal: "shops/shop_1/videos/video_1/original/demo.mp4",
          storageKeyOptimized: null,
          playbackUrl: "https://cdn.example.test/demo.mp4",
          thumbnailUrl: null,
          durationMs: 12345,
          width: 1920,
          height: 1080,
          failureReason: null,
          createdAt: now,
          updatedAt: now,
          productTags: [
            {
              id: "tag_1",
              shopId: "shop_1",
              videoId: "video_1",
              shopifyProductId: "gid://shopify/Product/1",
              shopifyVariantId: "gid://shopify/ProductVariant/1",
              productTitleSnapshot: "Linen Shirt",
              variantTitleSnapshot: "Small",
              productImageUrlSnapshot: null,
              priceSnapshot: null,
              currencyCodeSnapshot: null,
              position: 0,
              isActive: true,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      },
    ],
    ...overrides,
  };
}

describe("storefront analytics service", () => {
  it("accepts a valid product click and stores a safe analytics event", async () => {
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
      metadataJson: {},
    });

    await expect(
      ingestStorefrontAnalyticsEvent({
        input: {
          shop: "test-shop.myshopify.com",
          widgetId: "widget_1",
          videoId: "video_1",
          eventType: "PRODUCT_CLICK",
          productId: "gid://shopify/Product/1",
          variantId: "gid://shopify/ProductVariant/1",
          metadata: {
            source: "widget",
            ignoredObject: {
              nested: true,
            },
          },
        },
        widgetRepository: {
          findPublishedStorefrontWidget: vi.fn().mockResolvedValue(createWidget()),
        },
        analyticsEventRepository: {
          create,
        },
      }),
    ).resolves.toEqual({
      ok: true,
    });
    expect(create).toHaveBeenCalledWith({
      shopId: "shop_1",
      widgetId: "widget_1",
      videoId: "video_1",
      tagId: "tag_1",
      eventType: "PRODUCT_CLICKED",
      metadataJson: {
        source: "widget",
        storefrontEventType: "PRODUCT_CLICK",
      },
    });
    expect(JSON.stringify(create.mock.calls)).not.toContain("storageKeyOriginal");
    expect(JSON.stringify(create.mock.calls)).not.toContain("Cookie");
    expect(JSON.stringify(create.mock.calls)).not.toContain("Authorization");
  });

  it("maps widget and video events to existing database event types", async () => {
    const create = vi.fn().mockResolvedValue({});
    const widgetRepository = {
      findPublishedStorefrontWidget: vi.fn().mockResolvedValue(createWidget()),
    };
    const analyticsEventRepository = {
      create,
    };

    await ingestStorefrontAnalyticsEvent({
      input: {
        shop: "test-shop.myshopify.com",
        widgetId: "widget_1",
        eventType: "WIDGET_VIEW",
      },
      widgetRepository,
      analyticsEventRepository,
    });
    await ingestStorefrontAnalyticsEvent({
      input: {
        shop: "test-shop.myshopify.com",
        widgetId: "widget_1",
        videoId: "video_1",
        eventType: "VIDEO_PAUSE",
      },
      widgetRepository,
      analyticsEventRepository,
    });

    expect(create.mock.calls[0]?.[0]).toMatchObject({
      eventType: "WIDGET_VIEWED",
      videoId: null,
      tagId: null,
    });
    expect(create.mock.calls[1]?.[0]).toMatchObject({
      eventType: "VIDEO_PLAYED",
      videoId: "video_1",
      tagId: null,
      metadataJson: {
        storefrontEventType: "VIDEO_PAUSE",
      },
    });
  });

  it("rejects invalid event input safely", () => {
    expect(() =>
      parseStorefrontAnalyticsEvent({
        shop: "not-a-shop",
        widgetId: "widget_1",
        eventType: "WIDGET_VIEW",
      }),
    ).toThrow(StorefrontAnalyticsExpectedError);
    expect(() =>
      parseStorefrontAnalyticsEvent({
        shop: "test-shop.myshopify.com",
        widgetId: "widget_1",
        eventType: "UNKNOWN",
      }),
    ).toThrow(StorefrontAnalyticsExpectedError);
    expect(() =>
      parseStorefrontAnalyticsEvent({
        shop: "test-shop.myshopify.com",
        widgetId: "widget_1",
        videoId: "video_1",
        eventType: "PRODUCT_CLICK",
        productId: "gid://shopify/ProductVariant/1",
      }),
    ).toThrow(StorefrontAnalyticsExpectedError);
  });

  it("verifies widget ownership and video/tag relationships", async () => {
    await expect(
      ingestStorefrontAnalyticsEvent({
        input: {
          shop: "test-shop.myshopify.com",
          widgetId: "widget_1",
          videoId: "missing_video",
          eventType: "VIDEO_PLAY",
        },
        widgetRepository: {
          findPublishedStorefrontWidget: vi.fn().mockResolvedValue(createWidget()),
        },
        analyticsEventRepository: {
          create: vi.fn(),
        },
      }),
    ).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      ingestStorefrontAnalyticsEvent({
        input: {
          shop: "test-shop.myshopify.com",
          widgetId: "widget_1",
          eventType: "WIDGET_VIEW",
        },
        widgetRepository: {
          findPublishedStorefrontWidget: vi.fn().mockResolvedValue(null),
        },
        analyticsEventRepository: {
          create: vi.fn(),
        },
      }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });
});
