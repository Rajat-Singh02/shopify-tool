import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_WIDGETS_PATH,
  ADMIN_WIDGETS_SAFE_ERROR_MESSAGE,
  attachAdminWidgetVideo,
  createAdminWidget,
  detachAdminWidgetVideo,
  fetchAdminWidgetDetail,
  fetchAdminWidgets,
  updateAdminWidget,
} from "../services/admin-widgets";

const widget = {
  id: "widget_1",
  title: "Homepage videos",
  status: "DRAFT",
  layout: "INLINE_CAROUSEL",
  createdAt: "2026-05-23T00:00:00.000Z",
  updatedAt: "2026-05-23T00:00:00.000Z",
  videos: [],
};

describe("admin widgets client", () => {
  it("loads widgets from the authenticated admin endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ widgets: [widget] }));

    await expect(fetchAdminWidgets(fetcher)).resolves.toEqual({ widgets: [widget] });
    const headers = new Headers(fetcher.mock.calls[0]?.[1]?.headers);

    expect(fetcher.mock.calls[0]?.[0]).toBe(ADMIN_WIDGETS_PATH);
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Authorization")).toBeNull();
  });

  it("attaches an App Bridge ID token for widget mutations", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ widget }))
      .mockResolvedValueOnce(Response.json({ widget }))
      .mockResolvedValueOnce(Response.json({ widget }))
      .mockResolvedValueOnce(Response.json({ widget }))
      .mockResolvedValueOnce(Response.json({ detached: true }));
    const tokenProvider = () => Promise.resolve("shopify-id-token");

    await createAdminWidget({ title: "Homepage videos" }, fetcher, tokenProvider);
    await fetchAdminWidgetDetail("widget_1", fetcher, tokenProvider);
    await updateAdminWidget("widget_1", { status: "PUBLISHED" }, fetcher, tokenProvider);
    await attachAdminWidgetVideo("widget_1", "video_1", fetcher, tokenProvider);
    await detachAdminWidgetVideo("widget_1", "video_1", fetcher, tokenProvider);

    for (const call of fetcher.mock.calls) {
      expect(new Headers(call[1]?.headers).get("Authorization")).toBe("Bearer shopify-id-token");
    }
    expect(fetcher.mock.calls[0]?.[0]).toBe(ADMIN_WIDGETS_PATH);
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetcher.mock.calls[2]?.[0]).toBe(`${ADMIN_WIDGETS_PATH}/widget_1`);
    expect(fetcher.mock.calls[2]?.[1]?.method).toBe("PATCH");
    expect(fetcher.mock.calls[3]?.[0]).toBe(`${ADMIN_WIDGETS_PATH}/widget_1/videos`);
    expect(fetcher.mock.calls[4]?.[0]).toBe(`${ADMIN_WIDGETS_PATH}/widget_1/videos/video_1`);
    expect(fetcher.mock.calls[4]?.[1]?.method).toBe("DELETE");
  });

  it("throws a safe error when widget endpoints are rejected", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("raw backend failure", {
        status: 500,
      }),
    );

    await expect(fetchAdminWidgets(fetcher)).rejects.toThrow(ADMIN_WIDGETS_SAFE_ERROR_MESSAGE);
    await expect(createAdminWidget({ title: "Homepage videos" }, fetcher)).rejects.toThrow(
      ADMIN_WIDGETS_SAFE_ERROR_MESSAGE,
    );
  });
});
