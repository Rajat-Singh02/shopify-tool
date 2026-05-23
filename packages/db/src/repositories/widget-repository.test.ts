import { describe, expect, it, vi } from "vitest";

import {
  WidgetRepository,
  type AdminWidgetRecord,
  type StorefrontWidgetRecord,
  type WidgetRepositoryClient,
} from "./widget-repository";

const widget: StorefrontWidgetRecord = {
  id: "widget_1",
  shopId: "shop_1",
  name: "Homepage videos",
  status: "PUBLISHED",
  layout: "INLINE_CAROUSEL",
  settingsJson: {},
  createdAt: new Date("2026-05-23T00:00:00.000Z"),
  updatedAt: new Date("2026-05-23T00:00:00.000Z"),
  shop: {
    shopDomain: "test-shop.myshopify.com",
  },
  widgetVideos: [],
};

const adminWidget: AdminWidgetRecord = {
  id: "widget_1",
  shopId: "shop_1",
  name: "Homepage videos",
  status: "DRAFT",
  layout: "INLINE_CAROUSEL",
  settingsJson: {},
  createdAt: new Date("2026-05-23T00:00:00.000Z"),
  updatedAt: new Date("2026-05-23T00:00:00.000Z"),
  widgetVideos: [],
};

describe("WidgetRepository", () => {
  it("loads only a published widget for the requested installed shop", async () => {
    const findFirst = vi.fn().mockResolvedValue(widget);
    const client = {
      widget: {
        findFirst,
      },
    } as unknown as WidgetRepositoryClient;
    const repository = new WidgetRepository(client);

    await expect(
      repository.findPublishedStorefrontWidget("test-shop.myshopify.com", "widget_1"),
    ).resolves.toBe(widget);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: "widget_1",
        status: "PUBLISHED",
        shop: {
          shopDomain: "test-shop.myshopify.com",
          uninstalledAt: null,
        },
      },
      include: {
        shop: {
          select: {
            shopDomain: true,
          },
        },
        widgetVideos: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          include: {
            video: {
              include: {
                productTags: {
                  where: {
                    isActive: true,
                  },
                  orderBy: [{ position: "asc" }, { createdAt: "asc" }],
                },
              },
            },
          },
        },
      },
    });
  });

  it("lists, creates, finds, and updates widgets for a shop", async () => {
    const findMany = vi.fn().mockResolvedValue([adminWidget]);
    const create = vi.fn<WidgetRepositoryClient["widget"]["create"]>().mockResolvedValue(adminWidget);
    const findUnique = vi.fn().mockResolvedValue(adminWidget);
    const update = vi.fn().mockResolvedValue({ ...adminWidget, status: "PUBLISHED" });
    const client: WidgetRepositoryClient = {
      widget: {
        findMany,
        create,
        findUnique,
        update,
        findFirst: vi.fn(),
      },
      widgetVideo: {
        findFirst: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
    };
    const repository = new WidgetRepository(client);

    await expect(repository.listByShop("shop_1")).resolves.toEqual([adminWidget]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        shopId: "shop_1",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        widgetVideos: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          include: {
            video: true,
          },
        },
      },
    });

    await expect(repository.createForShop("shop_1", "Homepage videos")).resolves.toBe(adminWidget);
    expect(create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String) as string,
        shopId: "shop_1",
        name: "Homepage videos",
        status: "DRAFT",
        layout: "INLINE_CAROUSEL",
        settingsJson: {},
      },
      include: {
        widgetVideos: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          include: {
            video: true,
          },
        },
      },
    });

    await expect(repository.findByShop("shop_1", "widget_1")).resolves.toBe(adminWidget);
    await expect(
      repository.updateByShop("shop_1", "widget_1", { status: "PUBLISHED" }),
    ).resolves.toMatchObject({ status: "PUBLISHED" });
    expect(update).toHaveBeenCalledWith({
      where: {
        id: "widget_1",
      },
      data: {
        status: "PUBLISHED",
      },
      include: {
        widgetVideos: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          include: {
            video: true,
          },
        },
      },
    });
  });

  it("keeps widget video attachment idempotent and detaches safely", async () => {
    const video = {
      id: "video_1",
    } as Parameters<WidgetRepository["attachVideo"]>[2];
    const existingWidgetVideo = {
      id: "widget_video_1",
      videoId: "video_1",
      position: 0,
      createdAt: new Date("2026-05-23T00:00:00.000Z"),
      video,
    };
    const findFirst = vi.fn().mockResolvedValueOnce(existingWidgetVideo).mockResolvedValueOnce(null);
    const create =
      vi.fn<WidgetRepositoryClient["widgetVideo"]["create"]>().mockResolvedValue(existingWidgetVideo);
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const client: WidgetRepositoryClient = {
      widget: {
        findMany: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
      },
      widgetVideo: {
        findFirst,
        create,
        deleteMany,
      },
    };
    const repository = new WidgetRepository(client);

    await expect(repository.attachVideo("shop_1", "widget_1", video)).resolves.toBe(
      existingWidgetVideo,
    );
    await expect(repository.attachVideo("shop_1", "widget_1", video, 2)).resolves.toBe(
      existingWidgetVideo,
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String) as string,
        shopId: "shop_1",
        widgetId: "widget_1",
        videoId: "video_1",
        position: 2,
      },
      include: {
        video: true,
      },
    });

    await expect(repository.detachVideo("shop_1", "widget_1", "video_1")).resolves.toEqual({
      detached: true,
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        shopId: "shop_1",
        widgetId: "widget_1",
        videoId: "video_1",
      },
    });
  });
});
