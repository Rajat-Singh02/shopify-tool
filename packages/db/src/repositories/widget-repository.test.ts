import { describe, expect, it, vi } from "vitest";

import {
  WidgetRepository,
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

describe("WidgetRepository", () => {
  it("loads only a published widget for the requested installed shop", async () => {
    const findFirst = vi.fn().mockResolvedValue(widget);
    const client: WidgetRepositoryClient = {
      widget: {
        findFirst,
      },
    };
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
});
