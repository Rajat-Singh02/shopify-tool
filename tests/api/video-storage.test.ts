import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { VideoRecord } from "@shoppable-video/db";
import { afterEach, describe, expect, it } from "vitest";

import {
  DatabaseStorefrontMediaStorageResolver,
  DatabaseVideoProcessingStorageResolver,
} from "../../server/api/video-storage";

const now = new Date("2026-05-23T00:00:00.000Z");
let tempDir: string | undefined;

function createVideo(overrides: Partial<VideoRecord> = {}): VideoRecord {
  return {
    id: "video_1",
    shopId: "shop_1",
    source: "MANUAL_UPLOAD",
    originalFilename: "demo video.mp4",
    originalMimeType: "video/mp4",
    originalSizeBytes: 4n,
    status: "READY",
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

const repository = {
  readObject(key: string) {
    if (key !== "shops/shop_1/videos/video_1/original/demo.mp4") {
      return Promise.resolve(null);
    }

    return Promise.resolve({
      key,
      contentType: "video/mp4",
      sizeBytes: 4,
      body: new Uint8Array([1, 2, 3, 4]),
    });
  },
};

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("video storage resolvers", () => {
  it("resolves database objects directly for storefront media", async () => {
    const resolver = new DatabaseStorefrontMediaStorageResolver(repository);

    await expect(resolver.resolveOriginalObject(createVideo())).resolves.toEqual({
      kind: "bytes",
      body: new Uint8Array([1, 2, 3, 4]),
      contentType: "video/mp4",
      sizeBytes: 4,
    });
  });

  it("materializes database objects to a temporary file for ffprobe processing", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "database-video-storage-"));
    const resolver = new DatabaseVideoProcessingStorageResolver({ tempRoot: tempDir }, repository);
    const objectPath = await resolver.resolveOriginalObject(createVideo());

    expect(objectPath).toContain(tempDir);
    await expect(readFile(objectPath)).resolves.toEqual(Buffer.from([1, 2, 3, 4]));
  });

  it("rejects missing or mismatched database objects safely", async () => {
    const resolver = new DatabaseStorefrontMediaStorageResolver(repository);

    await expect(
      resolver.resolveOriginalObject(createVideo({ storageKeyOriginal: "shops/shop_1/videos/other/original/demo.mp4" })),
    ).rejects.toMatchObject({
      code: "STORAGE_OBJECT_MISSING",
    });
    await expect(
      resolver.resolveOriginalObject(createVideo({ originalSizeBytes: 5n })),
    ).rejects.toMatchObject({
      code: "STORAGE_OBJECT_MISSING",
    });
  });
});
