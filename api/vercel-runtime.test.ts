import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDashboardShopContextDiagnostic,
  handleVercelRuntimeRequest,
  resolveVercelRuntimeRoute,
} from "./[...path]";
import { StorefrontAnalyticsExpectedError } from "./storefront-analytics";
import { StorefrontWidgetExpectedError } from "./storefront-widget";

describe("Vercel runtime route surface", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("imports the serverless entry without app-source module resolution failures", () => {
    expect(typeof handleVercelRuntimeRequest).toBe("function");
    expect(typeof resolveVercelRuntimeRoute).toBe("function");
  });

  it.each([
    ["/api/admin/dashboard", "admin-dashboard"],
    ["/api/admin-dashboard", "admin-dashboard"],
    ["/api/admin/products/search", "product-search"],
    ["/api/admin-products-search", "product-search"],
    ["/api/admin/widgets", "admin-widget"],
    ["/api/admin/widgets/widget_1", "admin-widget"],
    ["/api/admin/widgets/widget_1/videos", "admin-widget"],
    ["/api/admin/widgets/widget_1/videos/video_1", "admin-widget"],
    ["/api/admin/videos", "video-library"],
    ["/api/admin/videos/video_1", "video-library"],
    ["/api/admin/videos/video_1/archive", "video-library"],
    ["/api/admin/videos/video_1/product-tags", "video-product-tags"],
    ["/api/admin/videos/video_1/product-tags/tag_1", "video-product-tags"],
    ["/api/admin/videos/upload-intent", "video-upload"],
    ["/api/admin/videos/video_1/upload", "video-upload"],
    ["/api/admin/videos/video_1/complete-upload", "video-upload"],
    ["/api/admin-videos/upload-intent", "video-upload"],
    ["/widget.js", "storefront-widget"],
    ["/api/storefront/widgets/widget_1", "storefront-widget"],
    ["/api/storefront/events", "storefront-event"],
    ["/api/webhooks", "webhook"],
    ["/webhooks", "webhook"],
    ["/api/auth/callback", "auth"],
    ["/auth/callback", "auth"],
    ["/api/health", "health"],
    ["/health", "health"],
  ] as const)("routes %s to %s", (pathname, route) => {
    expect(resolveVercelRuntimeRoute(pathname)).toBe(route);
  });

  it("serves health checks without loading the app runtime", async () => {
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/health", {
        method: "HEAD",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("serves safe authenticated admin dashboard data through the runtime adapter", async () => {
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/dashboard"),
      {
        handleAdminDashboard() {
          return Promise.resolve(
            Response.json({
              shop: {
                domain: "test-shop.myshopify.com",
                installedAt: "2026-05-22T00:00:00.000Z",
              },
              overview: {
                activeScopeLabel: "Manual upload only",
              },
            }),
          );
        },
      },
    );

    const body = (await response.json()) as {
      shop: {
        domain: string;
      };
    };
    const serializedBody = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.shop.domain).toBe("test-shop.myshopify.com");
    expect(serializedBody).not.toContain("accessToken");
    expect(serializedBody).not.toContain("session");
    expect(serializedBody).not.toContain("SHOPIFY_API_SECRET");
  });

  it("returns a safe unauthenticated dashboard response when no bearer token is present", async () => {
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/dashboard"),
    );

    const body = (await response.json()) as {
      message: string;
    };

    expect(response.status).toBe(410);
    expect(body.message).toBe(
      "We could not load the authenticated shop context. Reload the app from Shopify admin.",
    );
  });

  it("returns a safe dashboard response when Shopify token authentication fails", async () => {
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/dashboard", {
        headers: {
          Authorization: "Bearer invalid-token",
        },
      }),
      {
        authenticateAdmin() {
          throw new Error("raw token validation failure");
        },
      },
    );

    const serializedBody = JSON.stringify(await response.json());

    expect(response.status).toBe(410);
    expect(serializedBody).not.toContain("raw token validation failure");
    expect(serializedBody).not.toContain("invalid-token");
  });

  it("returns a safe product search response when no bearer token is present", async () => {
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/products/search?q=shirt"),
    );
    const body = (await response.json()) as {
      message: string;
    };

    expect(response.status).toBe(410);
    expect(body.message).toBe(
      "We could not search Shopify products. Reload the app from Shopify admin.",
    );
  });

  it("returns a safe product search response when Shopify token authentication fails", async () => {
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/products/search", {
        headers: {
          Authorization: "Bearer invalid-product-token",
        },
      }),
      {
        authenticateAdmin() {
          throw new Error("raw product token validation failure");
        },
      },
    );
    const serializedBody = JSON.stringify(await response.json());

    expect(response.status).toBe(410);
    expect(serializedBody).not.toContain("raw product token validation failure");
    expect(serializedBody).not.toContain("invalid-product-token");
  });

  it("searches products for a valid authenticated admin context", async () => {
    const searchProducts = vi.fn().mockResolvedValue({
      products: [
        {
          id: "gid://shopify/Product/1",
          title: "Linen Shirt",
          handle: "linen-shirt",
          status: "ACTIVE",
          featuredImage: null,
          variants: [
            {
              id: "gid://shopify/ProductVariant/1",
              title: "Default Title",
              sku: "LINEN-1",
              price: "24.00",
              inventoryQuantity: 4,
            },
          ],
        },
      ],
      pageInfo: {
        hasNextPage: true,
        endCursor: "cursor-1",
      },
    });
    const response = await handleVercelRuntimeRequest(
      new Request(
        "https://app.example.test/api/admin/products/search?q=linen%20shirt&first=80&after=cursor-0",
      ),
      {
        authenticateAdmin() {
          return Promise.resolve({
            session: {
              shop: "test-shop.myshopify.com",
            },
          });
        },
        loadProductSearchSession(shopDomain) {
          expect(shopDomain).toBe("test-shop.myshopify.com");
          return Promise.resolve({
            shop: shopDomain,
            accessToken: "offline-token",
          });
        },
        searchProducts,
      },
    );
    const body = (await response.json()) as {
      products: Array<{ title: string }>;
      pageInfo: { endCursor: string | null };
    };
    const serializedBody = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.products[0]?.title).toBe("Linen Shirt");
    expect(body.pageInfo.endCursor).toBe("cursor-1");
    expect(searchProducts).toHaveBeenCalledWith(
      {
        shop: "test-shop.myshopify.com",
        accessToken: "offline-token",
      },
      {
        q: "linen shirt",
        first: 80,
        after: "cursor-0",
      },
    );
    expect(serializedBody).not.toContain("offline-token");
    expect(serializedBody).not.toContain("accessToken");
    expect(serializedBody).not.toContain("session");
    expect(serializedBody).not.toContain("SHOPIFY_API_SECRET");
  });

  it("returns a safe admin widget response when no bearer token is present", async () => {
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/widgets"),
    );
    const body = (await response.json()) as {
      message: string;
    };

    expect(response.status).toBe(410);
    expect(body.message).toBe("We could not update widgets. Reload the app from Shopify admin.");
  });

  it("lists and creates admin widgets for a valid authenticated shop", async () => {
    const shop = {
      id: "shop_1",
      shopDomain: "test-shop.myshopify.com",
    };
    const widget = {
      id: "widget_1",
      title: "Homepage videos",
      status: "DRAFT",
      layout: "INLINE_CAROUSEL",
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z",
      videos: [],
    };
    const authenticateAdmin = vi.fn().mockResolvedValue({
      session: {
        shop: shop.shopDomain,
      },
    });
    const loadVideoUploadShop = vi.fn().mockResolvedValue(shop);
    const listAdminWidgets = vi.fn().mockResolvedValue({ widgets: [widget] });
    const createAdminWidget = vi.fn().mockResolvedValue(widget);

    const listResponse = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/widgets", {
        headers: {
          Authorization: "Bearer admin-widget-token",
        },
      }),
      {
        authenticateAdmin,
        loadVideoUploadShop,
        listAdminWidgets,
      },
    );
    const createResponse = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/widgets", {
        method: "POST",
        headers: {
          Authorization: "Bearer admin-widget-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "Homepage videos" }),
      }),
      {
        authenticateAdmin,
        loadVideoUploadShop,
        createAdminWidget,
      },
    );
    const listBody = (await listResponse.json()) as { widgets: Array<{ title: string }> };
    const createBody = (await createResponse.json()) as { widget: { title: string } };
    const serializedBodies = JSON.stringify([listBody, createBody]);

    expect(listResponse.status).toBe(200);
    expect(createResponse.status).toBe(201);
    expect(listBody.widgets[0]?.title).toBe("Homepage videos");
    expect(createBody.widget.title).toBe("Homepage videos");
    expect(listAdminWidgets).toHaveBeenCalledWith(shop);
    expect(createAdminWidget).toHaveBeenCalledWith(shop, { title: "Homepage videos" });
    expect(serializedBodies).not.toContain("admin-widget-token");
    expect(serializedBodies).not.toContain("accessToken");
    expect(serializedBodies).not.toContain("DATABASE_URL");
  });

  it("updates, attaches, and detaches admin widget videos safely", async () => {
    const shop = {
      id: "shop_1",
      shopDomain: "test-shop.myshopify.com",
    };
    const widget = {
      id: "widget_1",
      title: "Homepage videos",
      status: "PUBLISHED",
      layout: "INLINE_CAROUSEL",
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z",
      videos: [
        {
          id: "video_1",
          originalFilename: "demo.mp4",
          status: "READY",
          source: "MANUAL_UPLOAD",
          contentType: "video/mp4",
          durationMs: 12345,
          width: 1920,
          height: 1080,
        },
      ],
    };
    const dependencies = {
      authenticateAdmin: vi.fn().mockResolvedValue({
        session: {
          shop: shop.shopDomain,
        },
      }),
      loadVideoUploadShop: vi.fn().mockResolvedValue(shop),
      getAdminWidget: vi.fn().mockResolvedValue(widget),
      updateAdminWidget: vi.fn().mockResolvedValue(widget),
      attachAdminWidgetVideo: vi.fn().mockResolvedValue(widget),
      detachAdminWidgetVideo: vi.fn().mockResolvedValue({ detached: true }),
    };

    const detailResponse = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/widgets/widget_1", {
        headers: {
          Authorization: "Bearer admin-widget-token",
        },
      }),
      dependencies,
    );
    const updateResponse = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/widgets/widget_1", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer admin-widget-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "PUBLISHED" }),
      }),
      dependencies,
    );
    const attachResponse = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/widgets/widget_1/videos", {
        method: "POST",
        headers: {
          Authorization: "Bearer admin-widget-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoId: "video_1" }),
      }),
      dependencies,
    );
    const detachResponse = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/widgets/widget_1/videos/video_1", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer admin-widget-token",
        },
      }),
      dependencies,
    );
    const serializedBodies = JSON.stringify([
      await detailResponse.json(),
      await updateResponse.json(),
      await attachResponse.json(),
      await detachResponse.json(),
    ]);

    expect(detailResponse.status).toBe(200);
    expect(updateResponse.status).toBe(200);
    expect(attachResponse.status).toBe(200);
    expect(detachResponse.status).toBe(200);
    expect(dependencies.getAdminWidget).toHaveBeenCalledWith(shop, "widget_1");
    expect(dependencies.updateAdminWidget).toHaveBeenCalledWith(shop, "widget_1", {
      status: "PUBLISHED",
    });
    expect(dependencies.attachAdminWidgetVideo).toHaveBeenCalledWith(shop, "widget_1", {
      videoId: "video_1",
    });
    expect(dependencies.detachAdminWidgetVideo).toHaveBeenCalledWith(
      shop,
      "widget_1",
      "video_1",
    );
    expect(serializedBodies).not.toContain("admin-widget-token");
    expect(serializedBodies).not.toContain("session");
    expect(serializedBodies).not.toContain("/tmp/shoppable-video-storage");
  });

  it("serves the public storefront widget bootstrap script", async () => {
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/widget.js"),
    );
    const script = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/javascript");
    expect(script).toContain("data-shop");
    expect(script).toContain("data-widget-id");
    expect(script).toContain("/api/storefront/events");
    expect(script).toContain("sendBeacon");
    expect(script).not.toContain("SHOPIFY_API_SECRET");
    expect(script).not.toContain("DATABASE_URL");
    expect(script).not.toContain("accessToken");
  });

  it("serves a public storefront widget payload without admin auth", async () => {
    const loadStorefrontWidget = vi.fn().mockResolvedValue({
      widget: {
        id: "widget_1",
        shopDomain: "test-shop.myshopify.com",
        title: "Homepage videos",
        status: "PUBLISHED",
        layout: "INLINE_CAROUSEL",
      },
      videos: [
        {
          id: "video_1",
          status: "READY",
          source: "MANUAL_UPLOAD",
          contentType: "video/mp4",
          durationMs: 12345,
          width: 1920,
          height: 1080,
          publicUrl: null,
          tags: [
            {
              productId: "gid://shopify/Product/1",
              variantId: "gid://shopify/ProductVariant/1",
              productTitle: "Linen Shirt",
              variantTitle: "Small",
              sku: null,
            },
          ],
        },
      ],
    });
    const response = await handleVercelRuntimeRequest(
      new Request(
        "https://app.example.test/api/storefront/widgets/widget_1?shop=test-shop.myshopify.com",
      ),
      {
        loadStorefrontWidget,
      },
    );
    const body = (await response.json()) as {
      widget: { id: string };
      videos: Array<{ tags: Array<{ productTitle: string }> }>;
    };
    const serializedBody = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.widget.id).toBe("widget_1");
    expect(body.videos[0]?.tags[0]?.productTitle).toBe("Linen Shirt");
    expect(loadStorefrontWidget).toHaveBeenCalledWith("test-shop.myshopify.com", "widget_1");
    expect(serializedBody).not.toContain("accessToken");
    expect(serializedBody).not.toContain("session");
    expect(serializedBody).not.toContain("DATABASE_URL");
    expect(serializedBody).not.toContain("/tmp/shoppable-video-storage");
  });

  it("returns safe storefront widget errors for invalid or missing widgets", async () => {
    const invalidShopResponse = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/storefront/widgets/widget_1?shop=not-a-shop"),
    );
    const missingWidgetResponse = await handleVercelRuntimeRequest(
      new Request(
        "https://app.example.test/api/storefront/widgets/widget_1?shop=test-shop.myshopify.com",
      ),
      {
        loadStorefrontWidget() {
          return Promise.reject(new StorefrontWidgetExpectedError("Widget was not found", 404));
        },
      },
    );
    const invalidShopBody = (await invalidShopResponse.json()) as { message: string };
    const missingWidgetBody = (await missingWidgetResponse.json()) as { message: string };
    const serializedMissingWidgetBody = JSON.stringify(missingWidgetBody);

    expect(invalidShopResponse.status).toBe(400);
    expect(invalidShopBody.message).toBe("shop is invalid");
    expect(missingWidgetResponse.status).toBe(404);
    expect(serializedMissingWidgetBody).not.toContain("raw missing widget details");
  });

  it("records public storefront events without admin auth", async () => {
    const recordStorefrontEvent = vi.fn().mockResolvedValue({ ok: true });
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/storefront/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "ignored-cookie=1",
        },
        body: JSON.stringify({
          shop: "test-shop.myshopify.com",
          widgetId: "widget_1",
          videoId: "video_1",
          eventType: "VIDEO_PLAY",
        }),
      }),
      {
        recordStorefrontEvent,
      },
    );
    const body = (await response.json()) as { ok: true };
    const serializedBody = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(recordStorefrontEvent).toHaveBeenCalledWith({
      shop: "test-shop.myshopify.com",
      widgetId: "widget_1",
      videoId: "video_1",
      eventType: "VIDEO_PLAY",
    });
    expect(serializedBody).not.toContain("Cookie");
    expect(serializedBody).not.toContain("Authorization");
    expect(serializedBody).not.toContain("DATABASE_URL");
  });

  it("returns safe storefront event validation errors", async () => {
    const invalidJsonResponse = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/storefront/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{",
      }),
    );
    const invalidTypeResponse = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/storefront/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shop: "test-shop.myshopify.com",
          widgetId: "widget_1",
          eventType: "UNKNOWN",
        }),
      }),
      {
        recordStorefrontEvent() {
          return Promise.reject(
            new StorefrontAnalyticsExpectedError("eventType is invalid", 400),
          );
        },
      },
    );
    const unsupportedTypeResponse = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/storefront/events", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: "event",
      }),
    );

    expect(invalidJsonResponse.status).toBe(400);
    expect(invalidTypeResponse.status).toBe(400);
    expect(unsupportedTypeResponse.status).toBe(415);
  });

  it("returns a safe setup response when no offline Shopify session exists", async () => {
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/products/search"),
      {
        authenticateAdmin() {
          return Promise.resolve({
            session: {
              shop: "test-shop.myshopify.com",
            },
          });
        },
        loadProductSearchSession() {
          return Promise.resolve(undefined);
        },
        searchProducts() {
          throw new Error("should not search without a session");
        },
      },
    );
    const serializedBody = JSON.stringify(await response.json());

    expect(response.status).toBe(410);
    expect(serializedBody).not.toContain("accessToken");
    expect(serializedBody).not.toContain("session");
  });

  it("returns a safe video upload response when no bearer token is present", async () => {
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/videos/upload-intent", {
        method: "POST",
        body: JSON.stringify({
          filename: "demo.mp4",
          contentType: "video/mp4",
          sizeBytes: 4,
        }),
      }),
    );
    const body = (await response.json()) as {
      message: string;
    };

    expect(response.status).toBe(410);
    expect(body.message).toBe(
      "We could not handle the video upload request. Reload the app from Shopify admin.",
    );
  });

  it("returns a safe video upload response when Shopify token authentication fails", async () => {
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/videos/upload-intent", {
        method: "POST",
        headers: {
          Authorization: "Bearer invalid-video-token",
        },
        body: JSON.stringify({
          filename: "demo.mp4",
          contentType: "video/mp4",
          sizeBytes: 4,
        }),
      }),
      {
        authenticateAdmin() {
          throw new Error("raw video token validation failure");
        },
      },
    );
    const serializedBody = JSON.stringify(await response.json());

    expect(response.status).toBe(410);
    expect(serializedBody).not.toContain("raw video token validation failure");
    expect(serializedBody).not.toContain("invalid-video-token");
  });

  it("returns a safe video library response when no bearer token is present", async () => {
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/videos"),
    );
    const body = (await response.json()) as {
      message: string;
    };

    expect(response.status).toBe(410);
    expect(body.message).toBe(
      "We could not load the video library. Reload the app from Shopify admin.",
    );
  });

  it("lists videos for an authenticated shop through the runtime adapter", async () => {
    const listVideos = vi.fn().mockResolvedValue({
      videos: [
        {
          id: "video_1",
          source: "MANUAL_UPLOAD",
          status: "READY",
          originalFilename: "demo.mp4",
          contentType: "video/mp4",
          sizeBytes: 4,
          durationMs: 1234,
          width: 1280,
          height: 720,
          createdAt: "2026-05-23T00:00:00.000Z",
          updatedAt: "2026-05-23T00:00:00.000Z",
        },
      ],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    });
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/videos?first=10&status=READY"),
      {
        authenticateAdmin() {
          return Promise.resolve({
            session: {
              shop: "test-shop.myshopify.com",
            },
          });
        },
        loadVideoUploadShop() {
          return Promise.resolve({
            id: "shop_1",
            shopDomain: "test-shop.myshopify.com",
          });
        },
        listVideos,
      },
    );
    const body = (await response.json()) as {
      videos: Array<{ id: string }>;
    };
    const serializedBody = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.videos[0]?.id).toBe("video_1");
    expect(listVideos).toHaveBeenCalledWith(
      {
        id: "shop_1",
        shopDomain: "test-shop.myshopify.com",
      },
      expect.any(URLSearchParams),
    );
    expect(serializedBody).not.toContain("storageKeyOriginal");
    expect(serializedBody).not.toContain("accessToken");
    expect(serializedBody).not.toContain("DATABASE_URL");
  });

  it("returns video detail and archives through the runtime adapter", async () => {
    const getVideo = vi.fn().mockResolvedValue({
      id: "video_1",
      source: "MANUAL_UPLOAD",
      status: "READY",
      originalFilename: "demo.mp4",
      contentType: "video/mp4",
      sizeBytes: 4,
      durationMs: 1234,
      width: 1280,
      height: 720,
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z",
    });
    const archiveVideo = vi.fn().mockResolvedValue({
      id: "video_1",
      source: "MANUAL_UPLOAD",
      status: "ARCHIVED",
      originalFilename: "demo.mp4",
      contentType: "video/mp4",
      sizeBytes: 4,
      durationMs: 1234,
      width: 1280,
      height: 720,
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z",
    });
    const dependencies = {
      authenticateAdmin() {
        return Promise.resolve({
          session: {
            shop: "test-shop.myshopify.com",
          },
        });
      },
      loadVideoUploadShop() {
        return Promise.resolve({
          id: "shop_1",
          shopDomain: "test-shop.myshopify.com",
        });
      },
      getVideo,
      archiveVideo,
    };
    const detailResponse = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/videos/video_1"),
      dependencies,
    );
    const archiveResponse = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/videos/video_1/archive", {
        method: "POST",
      }),
      dependencies,
    );
    const detailBody = (await detailResponse.json()) as {
      video: {
        status: string;
      };
    };
    const archiveBody = (await archiveResponse.json()) as {
      video: {
        status: string;
      };
    };

    expect(detailResponse.status).toBe(200);
    expect(archiveResponse.status).toBe(200);
    expect(detailBody.video.status).toBe("READY");
    expect(archiveBody.video.status).toBe("ARCHIVED");
    expect(getVideo).toHaveBeenCalledWith(
      {
        id: "shop_1",
        shopDomain: "test-shop.myshopify.com",
      },
      "video_1",
    );
    expect(archiveVideo).toHaveBeenCalledWith(
      {
        id: "shop_1",
        shopDomain: "test-shop.myshopify.com",
      },
      "video_1",
    );
  });

  it("returns a safe product tagging response when no bearer token is present", async () => {
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/videos/video_1/product-tags"),
    );
    const body = (await response.json()) as {
      message: string;
    };

    expect(response.status).toBe(410);
    expect(body.message).toBe(
      "We could not update video product tags. Reload the app from Shopify admin.",
    );
  });

  it("lists, creates, and deletes video product tags through the runtime adapter", async () => {
    const tag = {
      id: "tag_1",
      videoId: "video_1",
      productId: "gid://shopify/Product/1",
      productTitle: "Linen Shirt",
      variantId: "gid://shopify/ProductVariant/1",
      variantTitle: "Small",
      createdAt: "2026-05-23T00:00:00.000Z",
    };
    const dependencies = {
      authenticateAdmin() {
        return Promise.resolve({
          session: {
            shop: "test-shop.myshopify.com",
          },
        });
      },
      loadVideoUploadShop() {
        return Promise.resolve({
          id: "shop_1",
          shopDomain: "test-shop.myshopify.com",
        });
      },
      listVideoProductTags: vi.fn().mockResolvedValue({
        tags: [tag],
      }),
      createVideoProductTag: vi.fn().mockResolvedValue(tag),
      deleteVideoProductTag: vi.fn().mockResolvedValue({
        deleted: true,
      }),
    };
    const listResponse = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/videos/video_1/product-tags"),
      dependencies,
    );
    const createResponse = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/videos/video_1/product-tags", {
        method: "POST",
        body: JSON.stringify({
          productId: "gid://shopify/Product/1",
          productTitle: "Linen Shirt",
          variantId: "gid://shopify/ProductVariant/1",
          variantTitle: "Small",
        }),
      }),
      dependencies,
    );
    const deleteResponse = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/videos/video_1/product-tags/tag_1", {
        method: "DELETE",
      }),
      dependencies,
    );
    const listBody = (await listResponse.json()) as {
      tags: Array<{ id: string }>;
    };
    const createBody = (await createResponse.json()) as {
      tag: {
        id: string;
      };
    };
    const deleteBody = (await deleteResponse.json()) as {
      deleted: boolean;
    };
    const serializedBody = JSON.stringify({
      listBody,
      createBody,
      deleteBody,
    });

    expect(listResponse.status).toBe(200);
    expect(createResponse.status).toBe(201);
    expect(deleteResponse.status).toBe(200);
    expect(listBody.tags[0]?.id).toBe("tag_1");
    expect(createBody.tag.id).toBe("tag_1");
    expect(deleteBody.deleted).toBe(true);
    expect(dependencies.listVideoProductTags).toHaveBeenCalledWith(
      {
        id: "shop_1",
        shopDomain: "test-shop.myshopify.com",
      },
      "video_1",
    );
    expect(dependencies.createVideoProductTag).toHaveBeenCalledWith(
      {
        id: "shop_1",
        shopDomain: "test-shop.myshopify.com",
      },
      "video_1",
      expect.objectContaining({
        productId: "gid://shopify/Product/1",
      }),
    );
    expect(dependencies.deleteVideoProductTag).toHaveBeenCalledWith(
      {
        id: "shop_1",
        shopDomain: "test-shop.myshopify.com",
      },
      "video_1",
      "tag_1",
    );
    expect(serializedBody).not.toContain("accessToken");
    expect(serializedBody).not.toContain("DATABASE_URL");
    expect(serializedBody).not.toContain("storageKeyOriginal");
  });

  it("creates a manual video upload intent for an authenticated shop", async () => {
    const createUploadIntent = vi.fn().mockResolvedValue({
      video: {
        id: "video_1",
        status: "UPLOADED",
        source: "MANUAL_UPLOAD",
        originalFilename: "demo.mp4",
        contentType: "video/mp4",
        sizeBytes: 4,
      },
      upload: {
        method: "PUT",
        url: "/api/admin/videos/video_1/upload",
        headers: {
          "Content-Type": "video/mp4",
        },
        expiresAt: "2026-05-23T00:15:00.000Z",
      },
    });
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/videos/upload-intent", {
        method: "POST",
        body: JSON.stringify({
          filename: "demo.mp4",
          contentType: "video/mp4",
          sizeBytes: 4,
        }),
      }),
      {
        authenticateAdmin() {
          return Promise.resolve({
            session: {
              shop: "test-shop.myshopify.com",
            },
          });
        },
        loadVideoUploadShop(shopDomain) {
          return Promise.resolve({
            id: "shop_1",
            shopDomain,
          });
        },
        createUploadIntent,
      },
    );
    const body = (await response.json()) as {
      video: {
        id: string;
      };
    };
    const serializedBody = JSON.stringify(body);

    expect(response.status).toBe(201);
    expect(body.video.id).toBe("video_1");
    expect(createUploadIntent).toHaveBeenCalledWith(
      {
        id: "shop_1",
        shopDomain: "test-shop.myshopify.com",
      },
      {
        filename: "demo.mp4",
        contentType: "video/mp4",
        sizeBytes: 4,
      },
    );
    expect(serializedBody).not.toContain("storageKeyOriginal");
    expect(serializedBody).not.toContain("accessToken");
    expect(serializedBody).not.toContain("DATABASE_URL");
  });

  it("writes a local upload only for the authenticated owning shop", async () => {
    const writeUploadObject = vi.fn().mockResolvedValue({
      id: "video_1",
      status: "UPLOADED",
      source: "MANUAL_UPLOAD",
      originalFilename: "demo.mp4",
      contentType: "video/mp4",
      sizeBytes: 4,
    });
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/videos/video_1/upload", {
        method: "PUT",
        headers: {
          "Content-Type": "video/mp4",
        },
        body: new Uint8Array([1, 2, 3, 4]),
      }),
      {
        authenticateAdmin() {
          return Promise.resolve({
            session: {
              shop: "test-shop.myshopify.com",
            },
          });
        },
        loadVideoUploadShop() {
          return Promise.resolve({
            id: "shop_1",
            shopDomain: "test-shop.myshopify.com",
          });
        },
        writeUploadObject,
      },
    );

    expect(response.status).toBe(200);
    expect(writeUploadObject).toHaveBeenCalledWith(
      {
        id: "shop_1",
        shopDomain: "test-shop.myshopify.com",
      },
      "video_1",
      expect.any(Request),
    );
  });

  it("completes a manual upload through the runtime adapter", async () => {
    const completeUpload = vi.fn().mockResolvedValue({
      id: "video_1",
      status: "UPLOADED",
      source: "MANUAL_UPLOAD",
      originalFilename: "demo.mp4",
      contentType: "video/mp4",
      sizeBytes: 4,
    });
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/videos/video_1/complete-upload", {
        method: "POST",
      }),
      {
        authenticateAdmin() {
          return Promise.resolve({
            session: {
              shop: "test-shop.myshopify.com",
            },
          });
        },
        loadVideoUploadShop() {
          return Promise.resolve({
            id: "shop_1",
            shopDomain: "test-shop.myshopify.com",
          });
        },
        completeUpload,
      },
    );

    expect(response.status).toBe(200);
    expect(completeUpload).toHaveBeenCalledWith(
      {
        id: "shop_1",
        shopDomain: "test-shop.myshopify.com",
      },
      "video_1",
    );
  });

  it("converts Shopify Admin API failures into safe product search JSON", async () => {
    vi.stubEnv("SHOPIFY_API_KEY", "test_api_key");
    vi.stubEnv("SHOPIFY_API_SECRET", "test_secret");
    vi.stubEnv("SHOPIFY_APP_URL", "https://app.example.test");
    vi.stubEnv("SHOPIFY_SCOPES", "read_products");
    vi.stubEnv("SHOPIFY_API_VERSION", "2026-04");
    const token = createTestSessionToken("test-shop.myshopify.com", "test_api_key", "test_secret");
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      Response.json(
        {
          errors: [{ message: "raw Shopify failure with offline-token" }],
        },
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/products/search?q=shirt", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
      {
        authenticateAdmin() {
          throw new Error("offline session unavailable");
        },
        loadProductSearchSession() {
          return Promise.resolve({
            shop: "test-shop.myshopify.com",
            accessToken: "offline-token",
          });
        },
      },
    );
    const serializedBody = JSON.stringify(await response.json());
    const serializedLogs = JSON.stringify(consoleError.mock.calls);

    expect(response.status).toBe(502);
    expect(serializedBody).toContain("Unable to search Shopify products right now.");
    expect(serializedBody).not.toContain("offline-token");
    expect(serializedBody).not.toContain("raw Shopify failure");
    expect(serializedLogs).not.toContain("offline-token");
    expect(serializedLogs).not.toContain("raw Shopify failure");

    consoleError.mockRestore();
  });

  it("resolves dashboard shop context from a valid App Bridge bearer token", async () => {
    vi.stubEnv("SHOPIFY_API_KEY", "test_api_key");
    vi.stubEnv("SHOPIFY_API_SECRET", "test_secret");
    vi.stubEnv("SHOPIFY_APP_URL", "https://app.example.test");
    vi.stubEnv("SHOPIFY_SCOPES", "read_products");
    vi.stubEnv("SHOPIFY_API_VERSION", "2026-04");
    const token = createTestSessionToken("test-shop.myshopify.com", "test_api_key", "test_secret");
    const loadDashboardShop = vi.fn().mockResolvedValue({
      shopDomain: "test-shop.myshopify.com",
      installedAt: new Date("2026-05-22T00:00:00.000Z"),
    });
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
      {
        authenticateAdmin() {
          throw new Error("offline session unavailable");
        },
        loadDashboardShop,
      },
    );
    const body = (await response.json()) as {
      shop: {
        domain: string;
      };
    };
    const serializedBody = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(loadDashboardShop).toHaveBeenCalledWith("test-shop.myshopify.com");
    expect(body.shop.domain).toBe("test-shop.myshopify.com");
    expect(serializedBody).not.toContain("accessToken");
    expect(serializedBody).not.toContain("session");
    expect(serializedBody).not.toContain("SHOPIFY_API_SECRET");
  });

  it("logs safe Prisma diagnostics when authenticated dashboard shop loading fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const prismaError = new Error("Invalid prisma.shop.upsert invocation with bearer abc") as Error & {
      code: string;
      clientVersion: string;
      meta: Record<string, unknown>;
    };
    prismaError.name = "PrismaClientKnownRequestError";
    prismaError.code = "P2022";
    prismaError.clientVersion = "7.8.0";
    prismaError.meta = {
      modelName: "Shop",
      column: "createdAt",
      accessToken: "secret-token",
      connectionString: "postgresql://secret",
    };

    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/dashboard"),
      {
        authenticateAdmin() {
          return Promise.resolve({
            session: {
              shop: "test-shop.myshopify.com",
            },
          });
        },
        loadDashboardShop() {
          throw prismaError;
        },
      },
    );
    const loggedDiagnostic = consoleError.mock.calls[0]?.[1] as unknown;
    const serializedDiagnostic = JSON.stringify(loggedDiagnostic);

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to load dashboard shop context",
      expect.objectContaining({
        operation: "dashboard.ensureShopContext",
        reason: "PrismaClientKnownRequestError",
        code: "P2022",
        clientVersion: "7.8.0",
        message: "[redacted]",
        meta: {
          modelName: "Shop",
          column: "createdAt",
        },
      }),
    );
    expect(serializedDiagnostic).not.toContain("secret-token");
    expect(serializedDiagnostic).not.toContain("postgresql://");
    expect(serializedDiagnostic).not.toContain("Authorization");

    consoleError.mockRestore();
  });

  it("keeps dashboard Prisma diagnostics limited to safe primitive metadata", () => {
    const error = new Error("relation missing") as Error & {
      code: string;
      clientVersion: string;
      meta: Record<string, unknown>;
    };
    error.name = "PrismaClientKnownRequestError";
    error.code = "P2021";
    error.clientVersion = "7.8.0";
    error.meta = {
      modelName: "Shop",
      table: "public.Shop",
      token: "should-not-log",
      nested: {
        modelName: "Nested",
      },
    };

    const diagnostic = createDashboardShopContextDiagnostic(error);

    expect(diagnostic).toEqual({
      operation: "dashboard.ensureShopContext",
      reason: "PrismaClientKnownRequestError",
      code: "P2021",
      clientVersion: "7.8.0",
      message: "relation missing",
      meta: {
        modelName: "Shop",
        table: "public.Shop",
      },
    });
  });

  it("routes webhook requests to the server handler and preserves rejection responses", async () => {
    const handleWebhook = vi.fn().mockResolvedValue(new Response(undefined, { status: 401 }));
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/webhooks", {
        method: "POST",
        body: '{"shop_domain":"test-shop.myshopify.com"}',
      }),
      {
        handleWebhook,
      },
    );

    expect(response.status).toBe(401);
    expect(handleWebhook).toHaveBeenCalledOnce();
  });

  it("routes auth requests through the Shopify auth prefix", async () => {
    const authenticatedRequests: Request[] = [];
    const authenticateAdmin = vi.fn((request: Request) => {
      authenticatedRequests.push(request);

      return Promise.resolve({ session: { shop: "test-shop.myshopify.com" } });
    });
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/auth/callback?shop=test-shop.myshopify.com"),
      {
        authenticateAdmin,
      },
    );
    const authenticatedRequest = authenticatedRequests[0];

    expect(response.status).toBe(204);
    expect(authenticatedRequest).toBeInstanceOf(Request);
    if (!authenticatedRequest) {
      throw new Error("Expected auth runtime to call Shopify admin authentication");
    }
    expect(new URL(authenticatedRequest.url).pathname).toBe("/auth/callback");
  });

  it("keeps the admin dashboard path on the Vercel server route surface", async () => {
    const vercelConfig = JSON.parse(await readFile("vercel.json", "utf8")) as {
      rewrites?: Array<{
        source: string;
        destination: string;
      }>;
    };

    expect(vercelConfig.rewrites).toEqual(
      expect.arrayContaining([
        {
          source: "/api/admin/dashboard",
          destination: "/api/admin-dashboard",
        },
      ]),
    );
  });

  it("keeps the product search path on the Vercel server route surface", async () => {
    const vercelConfig = JSON.parse(await readFile("vercel.json", "utf8")) as {
      rewrites?: Array<{
        source: string;
        destination: string;
      }>;
    };

    expect(vercelConfig.rewrites).toEqual(
      expect.arrayContaining([
        {
          source: "/api/admin/products/search",
          destination: "/api/admin-products-search",
        },
      ]),
    );
  });

  it("keeps the manual video upload paths on the Vercel server route surface", async () => {
    const vercelConfig = JSON.parse(await readFile("vercel.json", "utf8")) as {
      rewrites?: Array<{
        source: string;
        destination: string;
      }>;
    };

    expect(vercelConfig.rewrites).toEqual(
      expect.arrayContaining([
        {
          source: "/api/admin/videos/:path*",
          destination: "/api/admin-videos/:path*",
        },
      ]),
    );
  });

  it("keeps the canonical Shopify auth callback on a nested Vercel API function", async () => {
    const authFunction = await readFile("api/auth/[...path].ts", "utf8");
    const vercelConfig = JSON.parse(await readFile("vercel.json", "utf8")) as {
      rewrites?: Array<{
        source: string;
        destination: string;
      }>;
    };

    expect(authFunction).toContain("../[...path].js");
    expect(vercelConfig.rewrites).toEqual(
      expect.arrayContaining([
        {
          source: "/auth/:path*",
          destination: "/api/auth/:path*",
        },
      ]),
    );
  });
});

function createTestSessionToken(shop: string, apiKey: string, apiSecretKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://${shop}/admin`,
    dest: `https://${shop}`,
    aud: apiKey,
    sub: "123456789",
    exp: now + 3600,
    nbf: now - 3600,
    iat: now - 3600,
    jti: "test-jti",
    sid: "test-sid",
  };
  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", apiSecretKey)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString("base64url");
}
