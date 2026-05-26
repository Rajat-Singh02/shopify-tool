import { describe, expect, it, vi } from "vitest";

import {
  createStorefrontWidgetBootstrapScript,
  getStorefrontWidgetPayload,
  StorefrontWidgetExpectedError,
  toPublicStorefrontWidgetPayload,
} from "../../server/api/storefront-widget";
import type { StorefrontWidgetRecord } from "@shoppable-video/db";

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
        videoId: "video_ready",
        position: 0,
        createdAt: now,
        video: {
          id: "video_ready",
          shopId: "shop_1",
          source: "MANUAL_UPLOAD",
          originalFilename: "demo.mp4",
          originalMimeType: "video/mp4",
          originalSizeBytes: 12n,
          status: "READY",
          storageKeyOriginal: "shops/shop_1/videos/video_ready/original/demo.mp4",
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
              videoId: "video_ready",
              shopifyProductId: "gid://shopify/Product/1",
              shopifyVariantId: "gid://shopify/ProductVariant/1",
              productTitleSnapshot: "Linen Shirt",
              productHandleSnapshot: "linen-shirt",
              variantTitleSnapshot: "Small",
              productImageUrlSnapshot: null,
              priceSnapshot: null,
              currencyCodeSnapshot: null,
              position: 0,
              isActive: true,
              createdAt: now,
              updatedAt: now,
            },
            {
              id: "tag_inactive",
              shopId: "shop_1",
              videoId: "video_ready",
              shopifyProductId: "gid://shopify/Product/2",
              shopifyVariantId: "gid://shopify/ProductVariant/2",
              productTitleSnapshot: "Hidden Shirt",
              productHandleSnapshot: "hidden-shirt",
              variantTitleSnapshot: "Hidden",
              productImageUrlSnapshot: null,
              priceSnapshot: null,
              currencyCodeSnapshot: null,
              position: 1,
              isActive: false,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      },
      {
        id: "widget_video_2",
        shopId: "shop_1",
        widgetId: "widget_1",
        videoId: "video_archived",
        position: 1,
        createdAt: now,
        video: {
          id: "video_archived",
          shopId: "shop_1",
          source: "MANUAL_UPLOAD",
          originalFilename: "archived.mp4",
          originalMimeType: "video/mp4",
          originalSizeBytes: 12n,
          status: "ARCHIVED",
          storageKeyOriginal: "shops/shop_1/videos/video_archived/original/archived.mp4",
          storageKeyOptimized: null,
          playbackUrl: "https://cdn.example.test/archived.mp4",
          thumbnailUrl: null,
          durationMs: null,
          width: null,
          height: null,
          failureReason: null,
          createdAt: now,
          updatedAt: now,
          productTags: [],
        },
      },
      {
        id: "widget_video_3",
        shopId: "shop_1",
        widgetId: "widget_1",
        videoId: "video_local",
        position: 2,
        createdAt: now,
        video: {
          id: "video_local",
          shopId: "shop_1",
          source: "MANUAL_UPLOAD",
          originalFilename: "local.mp4",
          originalMimeType: "video/mp4",
          originalSizeBytes: 12n,
          status: "READY",
          storageKeyOriginal: "shops/shop_1/videos/video_local/original/local.mp4",
          storageKeyOptimized: null,
          playbackUrl: "/tmp/shoppable-video-storage/local.mp4",
          thumbnailUrl: null,
          durationMs: null,
          width: null,
          height: null,
          failureReason: null,
          createdAt: now,
          updatedAt: now,
          productTags: [],
        },
      },
    ],
    ...overrides,
  };
}

describe("storefront widget service", () => {
  it("maps only public safe ready video and active tag fields", () => {
    const payload = toPublicStorefrontWidgetPayload(createWidget());
    const serialized = JSON.stringify(payload);

    expect(payload.widget).toEqual({
      id: "widget_1",
      shopDomain: "test-shop.myshopify.com",
      title: "Homepage videos",
      status: "PUBLISHED",
      layout: "INLINE_CAROUSEL",
    });
    expect(payload.videos).toHaveLength(2);
    expect(payload.videos[0]).toMatchObject({
      id: "video_ready",
      status: "READY",
      source: "MANUAL_UPLOAD",
      contentType: "video/mp4",
      publicUrl: "https://cdn.example.test/demo.mp4",
      tags: [
        {
          productId: "gid://shopify/Product/1",
          variantId: "gid://shopify/ProductVariant/1",
          productTitle: "Linen Shirt",
          productHandle: "linen-shirt",
          variantTitle: "Small",
          sku: null,
        },
      ],
    });
    expect(payload.videos[1]?.publicUrl).toBeNull();
    expect(serialized).not.toContain("storageKey");
    expect(serialized).not.toContain("/tmp/shoppable-video-storage");
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain("Hidden Shirt");
  });

  it("generates public media URLs for ready local manual-upload videos without leaking storage keys", () => {
    const payload = toPublicStorefrontWidgetPayload(createWidget(), {
      publicBaseUrl: "https://app.example.test",
    });
    const localVideo = payload.videos.find((video) => video.id === "video_local");
    const serialized = JSON.stringify(payload);

    expect(localVideo?.publicUrl).toBe(
      "https://app.example.test/api/storefront/widgets/widget_1/videos/video_local/media?shop=test-shop.myshopify.com",
    );
    expect(serialized).not.toContain("storageKeyOriginal");
    expect(serialized).not.toContain("shops/shop_1/videos/video_local/original/local.mp4");
    expect(serialized).not.toContain("/tmp/shoppable-video-storage");
  });

  it("validates shop domains and widget ids before repository lookup", async () => {
    const widgetRepository = {
      findPublishedStorefrontWidget: vi.fn().mockResolvedValue(createWidget()),
    };

    await expect(
      getStorefrontWidgetPayload({
        shop: "not-a-shop.example.com",
        widgetId: "widget_1",
        widgetRepository,
      }),
    ).rejects.toMatchObject({
      status: 400,
      clientMessage: "shop is invalid",
    });
    await expect(
      getStorefrontWidgetPayload({
        shop: "test-shop.myshopify.com",
        widgetId: "../widget",
        widgetRepository,
      }),
    ).rejects.toBeInstanceOf(StorefrontWidgetExpectedError);
    expect(widgetRepository.findPublishedStorefrontWidget).not.toHaveBeenCalled();
  });

  it("returns 404 when the widget is missing for the requested shop", async () => {
    await expect(
      getStorefrontWidgetPayload({
        shop: "test-shop.myshopify.com",
        widgetId: "widget_1",
        widgetRepository: {
          findPublishedStorefrontWidget: vi.fn().mockResolvedValue(null),
        },
      }),
    ).rejects.toMatchObject({
      status: 404,
      clientMessage: "Widget was not found",
    });
  });

  it("keeps the bootstrap script dependency-free and secret-free", () => {
    const script = createStorefrontWidgetBootstrapScript();

    expect(script).toContain("data-shop");
    expect(script).toContain("data-widget-id");
    expect(script).toContain("/api/storefront/events");
    expect(script).toContain("sendBeacon");
    expect(script).toContain("keepalive");
    expect(script).toContain("media.autoplay = true");
    expect(script).toContain("media.controls = false");
    expect(script).toContain("media.loop = true");
    expect(script).toContain("media.muted = true");
    expect(script).toContain("sv-mute");
    expect(script).toContain(".sv-hidden{display:none!important}");
    expect(script).toContain("const setVisible = (node, visible)");
    expect(script).toContain("muteEventName");
    expect(script).toContain("window.dispatchEvent(new CustomEvent");
    expect(script).toContain("muteButtons.set(media, muteButton)");
    expect(script).toContain("const markMediaAvailable = () =>");
    expect(script).toContain("loadedmetadata");
    expect(script).toContain("loadeddata");
    expect(script).toContain("setVisible(fallback, false)");
    expect(script).toContain("setVisible(muteButton, true)");
    expect(script).toContain("media.src = video.publicUrl");
    expect(script).toContain("Video preview is unavailable.");
    expect(script).toContain("VIDEO_IMPRESSION");
    expect(script).toContain("PRODUCT_CLICK");
    expect(script).toContain("document.createElement(\"a\")");
    expect(script).toContain("/products/");
    expect(script).toContain("searchParams.set(\"variant\"");
    expect(script).toContain("slugifyProductTitle");
    expect(script).toContain("getVariantNumericId");
    expect(script).toContain("requestVideoPlay");
    expect(script).toContain(".catch(() => {})");
    expect(script).toContain("document.createElement");
    expect(script).toContain("script.parentNode.insertBefore");
    expect(script).toContain("textContent");
    expect(script).not.toContain("innerHTML");
    expect(script).not.toContain("SHOPIFY_API_SECRET");
    expect(script).not.toContain("DATABASE_URL");
    expect(script).not.toContain("accessToken");
  });
});
