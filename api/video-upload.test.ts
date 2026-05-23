import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { VideoRecord } from "@shoppable-video/db";

import {
  completeManualUpload,
  createManualUploadIntent,
  LocalStorageProvider,
  toSafeVideoDto,
  VideoUploadExpectedError,
  writeManualUploadObject,
} from "./video-upload";

const env = {
  ALLOWED_VIDEO_MIME_TYPES: "video/mp4,video/webm",
  MAX_VIDEO_SIZE_MB: "1",
  STORAGE_PROVIDER: "local",
  LOCAL_STORAGE_ROOT: "/tmp/shoppable-video-storage-test",
};

function createVideo(overrides: Partial<VideoRecord> = {}): VideoRecord {
  const now = new Date("2026-05-23T00:00:00.000Z");

  return {
    id: "video_1",
    shopId: "shop_1",
    source: "MANUAL_UPLOAD",
    originalFilename: "demo.mp4",
    originalMimeType: "video/mp4",
    originalSizeBytes: 4n,
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

describe("manual video upload services", () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it("creates an upload intent with a safe video DTO and same-origin upload URL", async () => {
    const createdVideos: VideoRecord[] = [];

    const result = await createManualUploadIntent({
      request: {
        filename: "demo video.mp4",
        contentType: "video/mp4",
        sizeBytes: 4,
      },
      shop: {
        id: "shop_1",
        shopDomain: "test-shop.myshopify.com",
      },
      videoRepository: {
        createManualUpload(input) {
          const video = createVideo({
            id: input.id,
            shopId: input.shopId,
            originalFilename: input.originalFilename,
            originalMimeType: input.originalMimeType,
            originalSizeBytes: BigInt(input.originalSizeBytes),
            storageKeyOriginal: input.storageKeyOriginal,
          });

          createdVideos.push(video);

          return Promise.resolve(video);
        },
      },
      env,
    });
    const serialized = JSON.stringify(result);

    expect(result.video).toMatchObject({
      status: "UPLOADED",
      source: "MANUAL_UPLOAD",
      originalFilename: "demo video.mp4",
      contentType: "video/mp4",
      sizeBytes: 4,
    });
    expect(result.upload.method).toBe("PUT");
    expect(result.upload.url).toBe(`/api/admin/videos/${result.video.id}/upload`);
    expect(createdVideos[0]?.storageKeyOriginal).toContain(`/videos/${result.video.id}/original/`);
    expect(serialized).not.toContain("storageKeyOriginal");
    expect(serialized).not.toContain("/tmp/");
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("DATABASE_URL");
  });

  it("rejects unsafe filenames, unsupported MIME types, and oversized uploads", async () => {
    const videoRepository = {
      createManualUpload() {
        throw new Error("should not create a video for invalid input");
      },
    };
    const shop = {
      id: "shop_1",
      shopDomain: "test-shop.myshopify.com",
    };

    await expect(
      createManualUploadIntent({
        request: { filename: "../demo.mp4", contentType: "video/mp4", sizeBytes: 4 },
        shop,
        videoRepository,
        env,
      }),
    ).rejects.toThrow(VideoUploadExpectedError);
    await expect(
      createManualUploadIntent({
        request: { filename: "demo.mp4", contentType: "application/pdf", sizeBytes: 4 },
        shop,
        videoRepository,
        env,
      }),
    ).rejects.toThrow(VideoUploadExpectedError);
    await expect(
      createManualUploadIntent({
        request: { filename: "demo.mp4", contentType: "video/mp4", sizeBytes: 2_000_000 },
        shop,
        videoRepository,
        env,
      }),
    ).rejects.toThrow(VideoUploadExpectedError);
  });

  it("keeps local storage writes inside the configured root", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "shoppable-video-upload-"));
    const provider = new LocalStorageProvider(tempDir);

    await provider.writeObject({
      key: "shops/shop_1/videos/video_1/original/demo.mp4",
      body: new Uint8Array([1, 2, 3, 4]),
      contentType: "video/mp4",
    });

    await expect(provider.readObjectForTest("shops/shop_1/videos/video_1/original/demo.mp4")).resolves
      .toHaveLength(4);
    await expect(
      provider.writeObject({
        key: "../escape.mp4",
        body: new Uint8Array([1]),
        contentType: "video/mp4",
      }),
    ).rejects.toThrow(VideoUploadExpectedError);
  });

  it("writes an upload only when MIME type and size match the intent", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "shoppable-video-upload-"));
    const provider = new LocalStorageProvider(tempDir);
    const video = createVideo();

    const dto = await writeManualUploadObject({
      video,
      contentType: "video/mp4",
      body: new Uint8Array([1, 2, 3, 4]),
      storageProvider: provider,
      env,
    });

    expect(dto).toEqual(toSafeVideoDto(video));
    await expect(provider.objectExists(video.storageKeyOriginal ?? "")).resolves.toBe(true);
    await expect(
      writeManualUploadObject({
        video,
        contentType: "video/webm",
        body: new Uint8Array([1, 2, 3, 4]),
        storageProvider: provider,
        env,
      }),
    ).rejects.toThrow(VideoUploadExpectedError);
    await expect(
      writeManualUploadObject({
        video,
        contentType: "video/mp4",
        body: new Uint8Array([1, 2, 3]),
        storageProvider: provider,
        env,
      }),
    ).rejects.toThrow(VideoUploadExpectedError);
  });

  it("completes an upload only when the stored object exists", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "shoppable-video-upload-"));
    const provider = new LocalStorageProvider(tempDir);
    const video = createVideo();
    let updated = false;
    const videoRepository = {
      markOriginalUploadComplete(input: VideoRecord) {
        updated = true;

        return Promise.resolve(input);
      },
    };

    await expect(
      completeManualUpload({ video, videoRepository, storageProvider: provider }),
    ).rejects.toThrow(VideoUploadExpectedError);

    await provider.writeObject({
      key: video.storageKeyOriginal ?? "",
      body: new Uint8Array([1, 2, 3]),
      contentType: "video/mp4",
    });

    await expect(
      completeManualUpload({ video, videoRepository, storageProvider: provider }),
    ).rejects.toThrow(VideoUploadExpectedError);

    await provider.writeObject({
      key: video.storageKeyOriginal ?? "",
      body: new Uint8Array([1, 2, 3, 4]),
      contentType: "video/mp4",
    });

    await expect(
      completeManualUpload({ video, videoRepository, storageProvider: provider }),
    ).resolves.toEqual(toSafeVideoDto(video));
    expect(updated).toBe(true);
  });

  it("dispatches processing after upload completion and returns the processed state", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "shoppable-video-upload-"));
    const provider = new LocalStorageProvider(tempDir);
    const video = createVideo();
    const processedVideo = createVideo({
      status: "READY",
      durationMs: 1234,
      width: 1280,
      height: 720,
    });
    const dispatcher = {
      dispatchVideoProcessingJob: vi.fn().mockResolvedValue(toSafeVideoDto(processedVideo)),
    };

    await provider.writeObject({
      key: video.storageKeyOriginal ?? "",
      body: new Uint8Array([1, 2, 3, 4]),
      contentType: "video/mp4",
    });

    const result = await completeManualUpload({
      video,
      videoRepository: {
        markOriginalUploadComplete(input: VideoRecord) {
          return Promise.resolve(input);
        },
      },
      storageProvider: provider,
      processingDispatcher: dispatcher,
    });
    const serialized = JSON.stringify(result);

    expect(dispatcher.dispatchVideoProcessingJob).toHaveBeenCalledWith({
      videoId: "video_1",
    });
    expect(result.status).toBe("READY");
    expect(serialized).not.toContain("storageKeyOriginal");
    expect(serialized).not.toContain(tempDir);
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("DATABASE_URL");
  });

  it("does not dispatch duplicate processing for already processing or ready videos", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "shoppable-video-upload-"));
    const provider = new LocalStorageProvider(tempDir);
    const dispatcher = {
      dispatchVideoProcessingJob: vi.fn(),
    };
    const videoRepository = {
      markOriginalUploadComplete() {
        throw new Error("should not mark repeated completion");
      },
    };

    await expect(
      completeManualUpload({
        video: createVideo({ status: "PROCESSING" }),
        videoRepository,
        storageProvider: provider,
        processingDispatcher: dispatcher,
      }),
    ).resolves.toMatchObject({ status: "PROCESSING" });
    await expect(
      completeManualUpload({
        video: createVideo({ status: "READY" }),
        videoRepository,
        storageProvider: provider,
        processingDispatcher: dispatcher,
      }),
    ).resolves.toMatchObject({ status: "READY" });

    expect(dispatcher.dispatchVideoProcessingJob).not.toHaveBeenCalled();
  });

  it("converts processing dispatch failures into a safe upload error", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "shoppable-video-upload-"));
    const provider = new LocalStorageProvider(tempDir);
    const video = createVideo();

    await provider.writeObject({
      key: video.storageKeyOriginal ?? "",
      body: new Uint8Array([1, 2, 3, 4]),
      contentType: "video/mp4",
    });

    await expect(
      completeManualUpload({
        video,
        videoRepository: {
          markOriginalUploadComplete(input: VideoRecord) {
            return Promise.resolve(input);
          },
        },
        storageProvider: provider,
        processingDispatcher: {
          dispatchVideoProcessingJob: vi.fn().mockRejectedValue(new Error("private /tmp/path")),
        },
      }),
    ).rejects.toMatchObject({
      status: 500,
      clientMessage: "We could not start video processing. Try completing the upload again.",
    });
  });
});
