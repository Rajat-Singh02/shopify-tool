import { describe, expect, it } from "vitest";

import {
  VideoRepository,
  type VideoRecord,
  type VideoRepositoryClient,
} from "./video-repository";

function createVideo(overrides: Partial<VideoRecord> = {}): VideoRecord {
  const now = new Date("2026-05-23T00:00:00.000Z");

  return {
    id: "video_1",
    shopId: "shop_1",
    source: "MANUAL_UPLOAD",
    originalFilename: "demo.mp4",
    originalMimeType: "video/mp4",
    originalSizeBytes: 12n,
    status: "UPLOADED",
    storageKeyOriginal: "shops/shop_1/videos/video_1/original/demo.mp4",
    storageKeyOptimized: null,
    playbackUrl: null,
    thumbnailUrl: null,
    durationMs: null,
    width: null,
    height: null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createClient(existingVideo: VideoRecord | null = null): {
  client: VideoRepositoryClient;
  created: VideoRecord[];
  updated: VideoRecord[];
} {
  const created: VideoRecord[] = [];
  const updated: VideoRecord[] = [];

  return {
    created,
    updated,
    client: {
      video: {
        create({ data }) {
          const video = createVideo({
            id: data.id,
            shopId: data.shopId,
            source: data.source,
            originalFilename: data.originalFilename,
            originalMimeType: data.originalMimeType,
            originalSizeBytes: data.originalSizeBytes,
            status: data.status,
            storageKeyOriginal: data.storageKeyOriginal,
          });

          created.push(video);

          return Promise.resolve(video);
        },
        findFirst({ where }) {
          if (existingVideo?.id === where.id && existingVideo.shopId === where.shopId) {
            return Promise.resolve(existingVideo);
          }

          return Promise.resolve(null);
        },
        update({ data }) {
          const video = createVideo({
            ...(existingVideo ?? {}),
            status: data.status,
            storageKeyOriginal: data.storageKeyOriginal ?? existingVideo?.storageKeyOriginal ?? null,
          });

          updated.push(video);

          return Promise.resolve(video);
        },
      },
    },
  };
}

describe("VideoRepository", () => {
  it("creates a manual upload video with required safe fields", async () => {
    const { client, created } = createClient();
    const repository = new VideoRepository(client);

    const video = await repository.createManualUpload({
      id: "video_123",
      shopId: "shop_1",
      originalFilename: "demo.mp4",
      originalMimeType: "video/mp4",
      originalSizeBytes: 12,
      storageKeyOriginal: "shops/shop_1/videos/video_123/original/demo.mp4",
    });

    expect(video).toMatchObject({
      id: "video_123",
      shopId: "shop_1",
      source: "MANUAL_UPLOAD",
      originalFilename: "demo.mp4",
      originalMimeType: "video/mp4",
      originalSizeBytes: 12n,
      status: "UPLOADED",
      storageKeyOriginal: "shops/shop_1/videos/video_123/original/demo.mp4",
    });
    expect(created).toHaveLength(1);
  });

  it("finds only videos owned by the current shop", async () => {
    const existingVideo = createVideo({ id: "video_1", shopId: "shop_1" });
    const { client } = createClient(existingVideo);
    const repository = new VideoRepository(client);

    await expect(repository.findOwnedVideo("shop_1", "video_1")).resolves.toBe(existingVideo);
    await expect(repository.findOwnedVideo("other_shop", "video_1")).resolves.toBeNull();
  });

  it("marks an original upload complete without changing ownership", async () => {
    const existingVideo = createVideo();
    const { client, updated } = createClient(existingVideo);
    const repository = new VideoRepository(client);

    const video = await repository.markOriginalUploadComplete(existingVideo);

    expect(video.status).toBe("UPLOADED");
    expect(updated[0]?.storageKeyOriginal).toBe(existingVideo.storageKeyOriginal);
  });
});
