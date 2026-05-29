import { describe, expect, it } from "vitest";

import { VideoRepository, type VideoRecord, type VideoRepositoryClient } from "./video-repository";

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
  countedArgs: unknown[];
  foundManyArgs: unknown[];
  updated: VideoRecord[];
} {
  const created: VideoRecord[] = [];
  const countedArgs: unknown[] = [];
  const foundManyArgs: unknown[] = [];
  const updated: VideoRecord[] = [];

  return {
    created,
    countedArgs,
    foundManyArgs,
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
        findUnique({ where }) {
          return Promise.resolve(existingVideo?.id === where.id ? existingVideo : null);
        },
        findFirst({ where }) {
          if (
            existingVideo &&
            existingVideo.id === where.id &&
            existingVideo.shopId === where.shopId
          ) {
            return Promise.resolve(existingVideo);
          }

          return Promise.resolve(null);
        },
        findMany(args) {
          foundManyArgs.push(args);

          if (!existingVideo) {
            return Promise.resolve([]);
          }

          return Promise.resolve(
            [
              existingVideo,
              createVideo({
                id: "video_2",
                createdAt: new Date("2026-05-22T00:00:00.000Z"),
              }),
            ].slice(0, args.take),
          );
        },
        count(args) {
          countedArgs.push(args);

          return Promise.resolve(args.where.status === "READY" ? 4 : 9);
        },
        update({ data }) {
          const video = createVideo({
            ...(existingVideo ?? {}),
            ...data,
            storageKeyOriginal:
              "storageKeyOriginal" in data
                ? (data.storageKeyOriginal ?? existingVideo?.storageKeyOriginal ?? null)
                : (existingVideo?.storageKeyOriginal ?? null),
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

  it("marks processing, ready, and failed states with safe metadata", async () => {
    const existingVideo = createVideo();
    const { client, updated } = createClient(existingVideo);
    const repository = new VideoRepository(client);

    await expect(repository.findById(existingVideo.id)).resolves.toBe(existingVideo);
    await repository.markProcessing(existingVideo.id);
    await repository.markReady(existingVideo.id, {
      durationMs: 1234,
      width: 1920,
      height: 1080,
    });
    await repository.markFailed(existingVideo.id, "ffprobe failed\nwith details");

    expect(updated[0]?.status).toBe("PROCESSING");
    expect(updated[1]).toMatchObject({
      status: "READY",
      durationMs: 1234,
      width: 1920,
      height: 1080,
      failureReason: null,
    });
    expect(updated[2]).toMatchObject({
      status: "FAILED",
      failureReason: "ffprobe failed with details",
    });
  });

  it("lists videos by shop with filters and cursor pagination", async () => {
    const existingVideo = createVideo();
    const { client, foundManyArgs } = createClient(existingVideo);
    const repository = new VideoRepository(client);

    const firstPage = await repository.listByShop({
      shopId: "shop_1",
      first: 1,
      status: "READY",
      source: "MANUAL_UPLOAD",
      q: "demo",
    });
    const secondPage = await repository.listByShop({
      shopId: "shop_1",
      first: 1,
      after: firstPage.pageInfo.endCursor,
    });

    expect(firstPage.videos).toHaveLength(1);
    expect(firstPage.pageInfo.hasNextPage).toBe(true);
    expect(firstPage.pageInfo.endCursor).toEqual(expect.any(String));
    expect(secondPage.videos).toHaveLength(1);
    expect(firstPage.summary).toEqual({
      totalCount: 4,
      readyCount: 4,
    });
    expect(foundManyArgs[0]).toMatchObject({
      where: {
        shopId: "shop_1",
        status: "READY",
        source: "MANUAL_UPLOAD",
        originalFilename: {
          contains: "demo",
          mode: "insensitive",
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 2,
    });
    expect(foundManyArgs[1]).toMatchObject({
      where: {
        shopId: "shop_1",
        AND: [
          {
            OR: expect.any(Array) as unknown,
          },
        ],
      },
    });
  });

  it("archives videos by shop idempotently", async () => {
    const existingVideo = createVideo();
    const { client, updated } = createClient(existingVideo);
    const repository = new VideoRepository(client);

    const archived = await repository.archiveByShop("shop_1", "video_1");
    const repeated = await new VideoRepository(
      createClient(createVideo({ status: "ARCHIVED" })).client,
    ).archiveByShop("shop_1", "video_1");
    const missing = await repository.archiveByShop("other_shop", "video_1");

    expect(archived).toMatchObject({
      status: "ARCHIVED",
    });
    expect(repeated).toMatchObject({
      status: "ARCHIVED",
    });
    expect(missing).toBeNull();
    expect(updated[0]).toMatchObject({
      status: "ARCHIVED",
    });
  });
});
