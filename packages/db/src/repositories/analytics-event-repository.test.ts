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
});
