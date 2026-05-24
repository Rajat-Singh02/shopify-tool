import { describe, expect, it, vi } from "vitest";

import type { VideoRecord } from "@shoppable-video/db";

import {
  archiveVideoLibraryItem,
  getVideoLibraryDetail,
  listVideoLibrary,
  retryVideoLibraryProcessing,
  toSafeVideoLibraryDto,
  VideoLibraryExpectedError,
} from "../../server/api/video-library";

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

const shop = {
  id: "shop_1",
  shopDomain: "test-shop.myshopify.com",
};
const validCursor = Buffer.from(
  JSON.stringify({
    createdAt: "2026-05-23T00:00:00.000Z",
    id: "video_0",
  }),
  "utf8",
).toString("base64url");

describe("video library services", () => {
  it("lists videos with safe DTOs and sanitized filters", async () => {
    const video = createVideo();
    const listByShop = vi.fn().mockResolvedValue({
      videos: [video],
      pageInfo: {
        hasNextPage: true,
        endCursor: "cursor_1",
      },
    });

    const result = await listVideoLibrary({
      shop,
      query: {
        first: "99",
        after: validCursor,
        status: "READY",
        source: "MANUAL_UPLOAD",
        q: "  demo    video  ",
      },
      videoRepository: {
        listByShop,
      },
    });
    const serialized = JSON.stringify(result);

    expect(listByShop).toHaveBeenCalledWith({
      shopId: "shop_1",
      first: 50,
      after: validCursor,
      status: "READY",
      source: "MANUAL_UPLOAD",
      q: "demo video",
    });
    expect(result.videos).toEqual([toSafeVideoLibraryDto(video)]);
    expect(result.pageInfo).toEqual({
      hasNextPage: true,
      endCursor: "cursor_1",
    });
    expect(serialized).not.toContain("storageKeyOriginal");
    expect(serialized).not.toContain("shops/shop_1");
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("DATABASE_URL");
  });

  it("rejects invalid list filters safely", async () => {
    const repository = {
      listByShop() {
        throw new Error("should not query for invalid filters");
      },
    };

    await expect(
      listVideoLibrary({
        shop,
        query: {
          first: "0",
        },
        videoRepository: repository,
      }),
    ).rejects.toThrow(VideoLibraryExpectedError);
    await expect(
      listVideoLibrary({
        shop,
        query: {
          status: "DELETED",
        },
        videoRepository: repository,
      }),
    ).rejects.toThrow(VideoLibraryExpectedError);
    await expect(
      listVideoLibrary({
        shop,
        query: {
          after: "tampered-cursor",
        },
        videoRepository: repository,
      }),
    ).rejects.toThrow(VideoLibraryExpectedError);
  });

  it("returns video detail only for the current shop", async () => {
    const video = createVideo();
    const findByShop = vi.fn().mockResolvedValue(video);

    await expect(
      getVideoLibraryDetail({
        shop,
        videoId: "video_1",
        videoRepository: {
          findByShop,
        },
      }),
    ).resolves.toEqual(toSafeVideoLibraryDto(video));
    expect(findByShop).toHaveBeenCalledWith("shop_1", "video_1");
    await expect(
      getVideoLibraryDetail({
        shop,
        videoId: "missing",
        videoRepository: {
          findByShop: vi.fn().mockResolvedValue(null),
        },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("archives videos idempotently through the repository", async () => {
    const archivedVideo = createVideo({ status: "ARCHIVED" });
    const archiveByShop = vi.fn().mockResolvedValue(archivedVideo);

    await expect(
      archiveVideoLibraryItem({
        shop,
        videoId: "video_1",
        videoRepository: {
          archiveByShop,
        },
      }),
    ).resolves.toEqual(toSafeVideoLibraryDto(archivedVideo));
    expect(archiveByShop).toHaveBeenCalledWith("shop_1", "video_1");
    await expect(
      archiveVideoLibraryItem({
        shop,
        videoId: "other_shop_video",
        videoRepository: {
          archiveByShop: vi.fn().mockResolvedValue(null),
        },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("retries uploaded video processing and returns the refreshed video", async () => {
    const readyVideo = createVideo({ status: "READY", durationMs: 1000 });
    const findByShop = vi.fn().mockResolvedValue(createVideo({ status: "UPLOADED" }));
    const findById = vi.fn().mockResolvedValue(readyVideo);
    const dispatchVideoProcessingJob = vi.fn().mockResolvedValue({
      id: "video_1",
      status: "READY",
      source: "MANUAL_UPLOAD",
      originalFilename: "demo.mp4",
      contentType: "video/mp4",
      sizeBytes: 123456,
    });

    await expect(
      retryVideoLibraryProcessing({
        shop,
        videoId: "video_1",
        videoRepository: {
          findByShop,
          findById,
          markOriginalUploadComplete: vi.fn(),
        },
        processingDispatcher: {
          dispatchVideoProcessingJob,
        },
      }),
    ).resolves.toEqual(toSafeVideoLibraryDto(readyVideo));
    expect(findByShop).toHaveBeenCalledWith("shop_1", "video_1");
    expect(dispatchVideoProcessingJob).toHaveBeenCalledWith({ videoId: "video_1" });
  });

  it("resets failed manual uploads before retrying processing", async () => {
    const failedVideo = createVideo({ status: "FAILED", failureReason: "FFPROBE_MISSING" });
    const uploadedVideo = createVideo({ status: "UPLOADED", failureReason: null });
    const readyVideo = createVideo({ status: "READY" });
    const markOriginalUploadComplete = vi.fn().mockResolvedValue(uploadedVideo);

    await retryVideoLibraryProcessing({
      shop,
      videoId: "video_1",
      videoRepository: {
        findByShop: vi.fn().mockResolvedValue(failedVideo),
        findById: vi.fn().mockResolvedValue(readyVideo),
        markOriginalUploadComplete,
      },
      processingDispatcher: {
        dispatchVideoProcessingJob: vi.fn().mockResolvedValue(toSafeVideoLibraryDto(readyVideo)),
      },
    });

    expect(markOriginalUploadComplete).toHaveBeenCalledWith(failedVideo);
  });

  it("rejects retry processing for missing, ready, processing, archived, and cross-shop videos", async () => {
    const repository = {
      findByShop: vi.fn(),
      findById: vi.fn(),
      markOriginalUploadComplete: vi.fn(),
    };
    const dispatcher = {
      dispatchVideoProcessingJob: vi.fn(),
    };

    repository.findByShop.mockResolvedValueOnce(null);
    await expect(
      retryVideoLibraryProcessing({
        shop,
        videoId: "missing",
        videoRepository: repository,
        processingDispatcher: dispatcher,
      }),
    ).rejects.toMatchObject({ status: 404 });

    for (const status of ["READY", "PROCESSING", "ARCHIVED"] as const) {
      repository.findByShop.mockResolvedValueOnce(createVideo({ status }));
      await expect(
        retryVideoLibraryProcessing({
          shop,
          videoId: "video_1",
          videoRepository: repository,
          processingDispatcher: dispatcher,
        }),
      ).rejects.toMatchObject({ status: 409 });
    }

    expect(dispatcher.dispatchVideoProcessingJob).not.toHaveBeenCalled();
  });

  it("returns the latest safe failed video when retry processing fails", async () => {
    const failedVideo = createVideo({ status: "FAILED", failureReason: "FFPROBE_MISSING" });
    const result = await retryVideoLibraryProcessing({
      shop,
      videoId: "video_1",
      videoRepository: {
        findByShop: vi.fn().mockResolvedValue(createVideo({ status: "UPLOADED" })),
        findById: vi.fn().mockResolvedValue(failedVideo),
        markOriginalUploadComplete: vi.fn(),
      },
      processingDispatcher: {
        dispatchVideoProcessingJob: vi.fn().mockRejectedValue(new Error("raw /tmp/path")),
      },
    });
    const serialized = JSON.stringify(result);

    expect(result.status).toBe("FAILED");
    expect(serialized).not.toContain("/tmp");
    expect(serialized).not.toContain("storageKeyOriginal");
  });
});
