import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { StorefrontWidgetRecord } from "@shoppable-video/db";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  serveStorefrontWidgetVideoMedia,
  StorefrontMediaExpectedError,
} from "../../server/api/storefront-media";

const now = new Date("2026-05-23T00:00:00.000Z");
const tempRoots: string[] = [];

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
          playbackUrl: null,
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

async function createMediaFile(contents = "video bytes"): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "storefront-media-"));
  const filePath = join(root, "demo.mp4");

  tempRoots.push(root);
  await writeFile(filePath, contents);

  return filePath;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("storefront media service", () => {
  it("serves ready attached manual-upload video bytes without exposing storage details", async () => {
    const filePath = await createMediaFile("video bytes");
    const widgetRepository = {
      findPublishedStorefrontWidget: vi.fn().mockResolvedValue(createWidget()),
    };
    const response = await serveStorefrontWidgetVideoMedia({
      request: new Request(
        "https://app.example.test/api/storefront/widgets/widget_1/videos/video_ready/media?shop=test-shop.myshopify.com",
      ),
      storageResolver: {
        resolveOriginalObject: vi.fn().mockResolvedValue(filePath),
      },
      widgetRepository,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("video/mp4");
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await response.text()).toBe("video bytes");
    expect(widgetRepository.findPublishedStorefrontWidget).toHaveBeenCalledWith(
      "test-shop.myshopify.com",
      "widget_1",
    );
  });

  it("supports byte ranges for video playback", async () => {
    const filePath = await createMediaFile("0123456789");
    const response = await serveStorefrontWidgetVideoMedia({
      request: new Request(
        "https://app.example.test/api/storefront/widgets/widget_1/videos/video_ready/media?shop=test-shop.myshopify.com",
        {
          headers: {
            Range: "bytes=2-5",
          },
        },
      ),
      storageResolver: {
        resolveOriginalObject: vi.fn().mockResolvedValue(filePath),
      },
      widgetRepository: {
        findPublishedStorefrontWidget: vi.fn().mockResolvedValue(createWidget()),
      },
    });

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 2-5/10");
    expect(response.headers.get("Content-Length")).toBe("4");
    expect(await response.text()).toBe("2345");
  });

  it("serves byte-backed media objects for durable preview storage", async () => {
    const response = await serveStorefrontWidgetVideoMedia({
      request: new Request(
        "https://app.example.test/api/storefront/widgets/widget_1/videos/video_ready/media?shop=test-shop.myshopify.com",
        {
          headers: {
            Range: "bytes=6-10",
          },
        },
      ),
      storageResolver: {
        resolveOriginalObject: vi.fn().mockResolvedValue({
          kind: "bytes",
          body: new TextEncoder().encode("video bytes"),
          contentType: "video/mp4",
          sizeBytes: 11,
        }),
      },
      widgetRepository: {
        findPublishedStorefrontWidget: vi.fn().mockResolvedValue(createWidget()),
      },
    });

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Type")).toBe("video/mp4");
    expect(response.headers.get("Content-Range")).toBe("bytes 6-10/11");
    expect(await response.text()).toBe("bytes");
  });

  it("rejects missing widgets and non-ready attached videos safely", async () => {
    await expect(
      serveStorefrontWidgetVideoMedia({
        request: new Request(
          "https://app.example.test/api/storefront/widgets/widget_1/videos/video_ready/media?shop=test-shop.myshopify.com",
        ),
        storageResolver: {
          resolveOriginalObject: vi.fn(),
        },
        widgetRepository: {
          findPublishedStorefrontWidget: vi.fn().mockResolvedValue(null),
        },
      }),
    ).rejects.toMatchObject({
      status: 404,
      clientMessage: "Video media was not found",
    });

    await expect(
      serveStorefrontWidgetVideoMedia({
        request: new Request(
          "https://app.example.test/api/storefront/widgets/widget_1/videos/video_ready/media?shop=test-shop.myshopify.com",
        ),
        storageResolver: {
          resolveOriginalObject: vi.fn(),
        },
        widgetRepository: {
          findPublishedStorefrontWidget: vi.fn().mockResolvedValue(
            createWidget({
              widgetVideos: [
                {
                  ...createWidget().widgetVideos[0]!,
                  video: {
                    ...createWidget().widgetVideos[0]!.video,
                    status: "UPLOADED",
                  },
                },
              ],
            }),
          ),
        },
      }),
    ).rejects.toBeInstanceOf(StorefrontMediaExpectedError);
  });

  it("does not expose storage resolver errors or private paths", async () => {
    await expect(
      serveStorefrontWidgetVideoMedia({
        request: new Request(
          "https://app.example.test/api/storefront/widgets/widget_1/videos/video_ready/media?shop=test-shop.myshopify.com",
        ),
        storageResolver: {
          resolveOriginalObject: vi
            .fn()
            .mockRejectedValue(new Error("/tmp/private/storage/demo.mp4")),
        },
        widgetRepository: {
          findPublishedStorefrontWidget: vi.fn().mockResolvedValue(createWidget()),
        },
      }),
    ).rejects.toMatchObject({
      status: 404,
      clientMessage: "Video media was not found",
      message: "Video media was not found",
    });
  });
});
