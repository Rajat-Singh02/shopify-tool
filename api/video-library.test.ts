import { describe, expect, it, vi } from "vitest";

import type { VideoRecord } from "@shoppable-video/db";

import {
  archiveVideoLibraryItem,
  getVideoLibraryDetail,
  listVideoLibrary,
  toSafeVideoLibraryDto,
  VideoLibraryExpectedError,
} from "./video-library";

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
        after: "cursor_0",
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
      after: "cursor_0",
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
});
