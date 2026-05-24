import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_VIDEO_LIBRARY_PATH,
  archiveAdminVideo,
  fetchAdminVideoDetail,
  fetchAdminVideoLibrary,
  retryAdminVideoProcessing,
  VIDEO_LIBRARY_SAFE_ERROR_MESSAGE,
} from "../services/video-library";

describe("video library client", () => {
  it("loads videos from the authenticated admin endpoint", async () => {
    const result = {
      videos: [],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(result));

    await expect(
      fetchAdminVideoLibrary(
        {
          q: " demo ",
          first: 20,
          status: "READY",
          source: "MANUAL_UPLOAD",
        },
        fetcher,
      ),
    ).resolves.toEqual(result);
    const headers = new Headers(fetcher.mock.calls[0]?.[1]?.headers);

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      `${ADMIN_VIDEO_LIBRARY_PATH}?first=20&status=READY&source=MANUAL_UPLOAD&q=demo`,
    );
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Authorization")).toBeNull();
  });

  it("attaches an App Bridge ID token for list, detail, archive, and retry requests", async () => {
    const video = {
      id: "video_1",
      source: "MANUAL_UPLOAD",
      status: "READY",
      originalFilename: "demo.mp4",
      contentType: "video/mp4",
      sizeBytes: 4,
      durationMs: 1000,
      width: 640,
      height: 360,
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:01:00.000Z",
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          videos: [video],
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        }),
      )
      .mockResolvedValueOnce(Response.json(video))
      .mockResolvedValueOnce(Response.json({ video: { ...video, status: "ARCHIVED" } }))
      .mockResolvedValueOnce(Response.json({ video: { ...video, status: "READY" } }));
    const tokenProvider = () => Promise.resolve("shopify-id-token");

    await fetchAdminVideoLibrary({ after: "cursor-1", first: 20 }, fetcher, tokenProvider);
    await fetchAdminVideoDetail("video_1", fetcher, tokenProvider);
    await archiveAdminVideo("video_1", fetcher, tokenProvider);
    await retryAdminVideoProcessing("video_1", fetcher, tokenProvider);

    for (const call of fetcher.mock.calls) {
      expect(new Headers(call[1]?.headers).get("Authorization")).toBe("Bearer shopify-id-token");
    }
    expect(fetcher.mock.calls[0]?.[0]).toBe(`${ADMIN_VIDEO_LIBRARY_PATH}?first=20&after=cursor-1`);
    expect(fetcher.mock.calls[1]?.[0]).toBe(`${ADMIN_VIDEO_LIBRARY_PATH}/video_1`);
    expect(fetcher.mock.calls[2]?.[0]).toBe(`${ADMIN_VIDEO_LIBRARY_PATH}/video_1/archive`);
    expect(fetcher.mock.calls[2]?.[1]?.method).toBe("POST");
    expect(fetcher.mock.calls[3]?.[0]).toBe(`${ADMIN_VIDEO_LIBRARY_PATH}/video_1/retry-processing`);
    expect(fetcher.mock.calls[3]?.[1]?.method).toBe("POST");
  });

  it("throws a safe error when the video library endpoint is rejected", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("raw backend failure", {
        status: 500,
      }),
    );

    await expect(fetchAdminVideoLibrary({}, fetcher)).rejects.toThrow(
      VIDEO_LIBRARY_SAFE_ERROR_MESSAGE,
    );
  });
});
