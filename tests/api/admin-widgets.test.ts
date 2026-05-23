import { describe, expect, it, vi } from "vitest";

import type { AdminWidgetRecord, VideoRecord } from "@shoppable-video/db";

import {
  AdminWidgetExpectedError,
  attachAdminWidgetVideo,
  createAdminWidget,
  detachAdminWidgetVideo,
  getAdminWidget,
  listAdminWidgets,
  toSafeAdminWidgetDto,
  updateAdminWidget,
} from "../../api/admin-widgets";

const shop = {
  id: "shop_1",
  shopDomain: "test-shop.myshopify.com",
};

function createVideo(overrides: Partial<VideoRecord> = {}): VideoRecord {
  const now = new Date("2026-05-23T00:00:00.000Z");

  return {
    id: "video_1",
    shopId: "shop_1",
    source: "MANUAL_UPLOAD",
    originalFilename: "demo.mp4",
    originalMimeType: "video/mp4",
    originalSizeBytes: 123456n,
    status: "READY",
    storageKeyOriginal: "shops/shop_1/videos/video_1/original/demo.mp4",
    storageKeyOptimized: null,
    playbackUrl: null,
    thumbnailUrl: null,
    durationMs: 12345,
    width: 1920,
    height: 1080,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createWidget(overrides: Partial<AdminWidgetRecord> = {}): AdminWidgetRecord {
  const now = new Date("2026-05-23T00:00:00.000Z");

  return {
    id: "widget_1",
    shopId: "shop_1",
    name: "Homepage videos",
    status: "DRAFT",
    layout: "INLINE_CAROUSEL",
    settingsJson: {},
    createdAt: now,
    updatedAt: now,
    widgetVideos: [
      {
        id: "widget_video_1",
        videoId: "video_1",
        position: 0,
        createdAt: now,
        video: createVideo(),
      },
    ],
    ...overrides,
  };
}

describe("admin widget services", () => {
  it("lists current-shop widgets as safe DTOs", async () => {
    const widget = createWidget();

    const result = await listAdminWidgets({
      shop,
      widgetRepository: {
        listByShop: vi.fn().mockResolvedValue([widget]),
      },
    });
    const serialized = JSON.stringify(result);

    expect(result).toEqual({
      widgets: [toSafeAdminWidgetDto(widget)],
    });
    expect(serialized).not.toContain("storageKeyOriginal");
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("DATABASE_URL");
  });

  it("creates widgets with a trimmed title", async () => {
    const createForShop = vi.fn().mockResolvedValue(
      createWidget({
        name: "Homepage videos",
        widgetVideos: [],
      }),
    );

    await expect(
      createAdminWidget({
        shop,
        input: {
          title: "  Homepage    videos  ",
        },
        widgetRepository: {
          createForShop,
        },
      }),
    ).resolves.toMatchObject({
      title: "Homepage videos",
      status: "DRAFT",
    });
    expect(createForShop).toHaveBeenCalledWith("shop_1", "Homepage videos");
  });

  it("rejects invalid widget create and update input safely", async () => {
    await expect(
      createAdminWidget({
        shop,
        input: {
          title: "   ",
        },
        widgetRepository: {
          createForShop: vi.fn(),
        },
      }),
    ).rejects.toThrow(AdminWidgetExpectedError);

    await expect(
      updateAdminWidget({
        shop,
        widgetId: "widget_1",
        input: {
          status: "DELETED",
        },
        widgetRepository: {
          updateByShop: vi.fn(),
        },
      }),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  it("loads and updates widget detail only for the current shop", async () => {
    const widget = createWidget({ widgetVideos: [] });
    const findByShop = vi.fn().mockResolvedValue(widget);
    const updateByShop = vi.fn().mockResolvedValue({ ...widget, status: "PUBLISHED" });

    await expect(
      getAdminWidget({
        shop,
        widgetId: "widget_1",
        widgetRepository: {
          findByShop,
        },
      }),
    ).resolves.toEqual(toSafeAdminWidgetDto(widget));
    expect(findByShop).toHaveBeenCalledWith("shop_1", "widget_1");

    await expect(
      updateAdminWidget({
        shop,
        widgetId: "widget_1",
        input: {
          title: "Published widget",
          status: "PUBLISHED",
        },
        widgetRepository: {
          updateByShop,
        },
      }),
    ).resolves.toMatchObject({ status: "PUBLISHED" });
    expect(updateByShop).toHaveBeenCalledWith("shop_1", "widget_1", {
      name: "Published widget",
      status: "PUBLISHED",
    });
  });

  it("attaches only ready current-shop videos and returns the refreshed widget", async () => {
    const widget = createWidget({ widgetVideos: [] });
    const updatedWidget = createWidget();
    const findByShop = vi.fn().mockResolvedValueOnce(widget).mockResolvedValueOnce(updatedWidget);
    const attachVideo = vi.fn().mockResolvedValue(updatedWidget.widgetVideos[0]);

    await expect(
      attachAdminWidgetVideo({
        shop,
        widgetId: "widget_1",
        input: {
          videoId: "video_1",
        },
        widgetRepository: {
          findByShop,
          attachVideo,
        },
        videoRepository: {
          findByShop: vi.fn().mockResolvedValue(createVideo()),
        },
      }),
    ).resolves.toEqual(toSafeAdminWidgetDto(updatedWidget));
    expect(attachVideo).toHaveBeenCalledWith("shop_1", "widget_1", createVideo(), 0);
  });

  it("rejects missing or not-ready videos before attaching", async () => {
    await expect(
      attachAdminWidgetVideo({
        shop,
        widgetId: "widget_1",
        input: {
          videoId: "video_1",
        },
        widgetRepository: {
          findByShop: vi.fn().mockResolvedValue(createWidget()),
          attachVideo: vi.fn(),
        },
        videoRepository: {
          findByShop: vi.fn().mockResolvedValue(createVideo({ status: "ARCHIVED" })),
        },
      }),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it("detaches videos only after verifying widget ownership", async () => {
    const detachVideo = vi.fn().mockResolvedValue({ detached: true });

    await expect(
      detachAdminWidgetVideo({
        shop,
        widgetId: "widget_1",
        videoId: "video_1",
        widgetRepository: {
          findByShop: vi.fn().mockResolvedValue(createWidget()),
          detachVideo,
        },
      }),
    ).resolves.toEqual({ detached: true });
    expect(detachVideo).toHaveBeenCalledWith("shop_1", "widget_1", "video_1");

    await expect(
      detachAdminWidgetVideo({
        shop,
        widgetId: "missing_widget",
        videoId: "video_1",
        widgetRepository: {
          findByShop: vi.fn().mockResolvedValue(null),
          detachVideo: vi.fn(),
        },
      }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });
});
