import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { VideoRecord, VideoRepository } from "@shoppable-video/db";

import {
  extractVideoMetadata,
  LocalVideoStorageResolver,
  parseFfprobeMetadata,
  processVideoJob,
  VideoProcessingExpectedError,
  type VideoMetadata,
} from "./index";

type ProcessingRepository = Pick<
  VideoRepository,
  "findById" | "markProcessing" | "markReady" | "markFailed"
>;

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

function createRepository(video: VideoRecord | null): {
  repository: ProcessingRepository;
  transitions: string[];
} {
  const transitions: string[] = [];
  let current = video;

  return {
    transitions,
    repository: {
      findById: vi.fn((videoId: string) =>
        Promise.resolve(current?.id === videoId ? current : null),
      ),
      markProcessing: vi.fn((videoId: string) => {
        if (!current || current.id !== videoId) {
          throw new Error("missing video");
        }

        transitions.push("PROCESSING");
        current = createVideo({
          ...current,
          status: "PROCESSING",
          failureReason: null,
        });

        return Promise.resolve(current);
      }),
      markReady: vi.fn((videoId: string, metadata: Parameters<ProcessingRepository["markReady"]>[1]) => {
        if (!current || current.id !== videoId) {
          throw new Error("missing video");
        }

        transitions.push("READY");
        current = createVideo({
          ...current,
          status: "READY",
          durationMs: metadata.durationMs,
          width: metadata.width,
          height: metadata.height,
          failureReason: null,
        });

        return Promise.resolve(current);
      }),
      markFailed: vi.fn((videoId: string, failureReason: string) => {
        if (!current || current.id !== videoId) {
          throw new Error("missing video");
        }

        transitions.push("FAILED");
        current = createVideo({
          ...current,
          status: "FAILED",
          failureReason,
        });

        return Promise.resolve(current);
      }),
    },
  };
}

const ffprobeOutput = JSON.stringify({
  streams: [
    {
      codec_type: "audio",
      codec_name: "aac",
    },
    {
      codec_type: "video",
      codec_name: "h264",
      width: 1920,
      height: 1080,
      duration: "12.345",
      bit_rate: "600000",
    },
  ],
  format: {
    format_name: "mov,mp4,m4a,3gp,3g2,mj2",
    duration: "12.400",
    bit_rate: "800000",
  },
});

describe("video processing worker", () => {
  it("parses ffprobe metadata into a safe DTO", () => {
    expect(parseFfprobeMetadata(ffprobeOutput)).toEqual({
      durationSeconds: 12.345,
      durationMs: 12345,
      width: 1920,
      height: 1080,
      formatName: "mov,mp4,m4a,3gp,3g2,mj2",
      videoCodec: "h264",
      bitrate: 600000,
    });
  });

  it("uses the injected ffprobe executor without requiring a real binary", async () => {
    const runFfprobe = vi.fn().mockResolvedValue(ffprobeOutput);

    const metadata = await extractVideoMetadata("/tmp/demo.mp4", {
      ffprobePath: "custom-ffprobe",
      timeoutMs: 5000,
      runFfprobe,
    });

    expect(metadata.videoCodec).toBe("h264");
    expect(runFfprobe).toHaveBeenCalledWith("/tmp/demo.mp4", {
      ffprobePath: "custom-ffprobe",
      timeoutMs: 5000,
    });
  });

  it("rejects invalid ffprobe output safely", () => {
    expect(() => parseFfprobeMetadata("not-json")).toThrow(VideoProcessingExpectedError);
    expect(() => parseFfprobeMetadata(JSON.stringify({ streams: [] }))).toThrow(
      "ffprobe did not find a video stream",
    );
  });

  it("marks an uploaded video processing then ready on success", async () => {
    const { repository, transitions } = createRepository(createVideo());
    const metadata: VideoMetadata = {
      durationSeconds: 7.5,
      durationMs: 7500,
      width: 1280,
      height: 720,
      formatName: "mp4",
      videoCodec: "h264",
      bitrate: null,
    };

    const result = await processVideoJob(
      {
        videoId: "video_1",
      },
      {
        videoRepository: repository,
        storageResolver: {
          resolveOriginalObject: vi.fn().mockResolvedValue("/private/storage/demo.mp4"),
        },
        extractMetadata: vi.fn().mockResolvedValue(metadata),
      },
    );
    const serialized = JSON.stringify(result);

    expect(transitions).toEqual(["PROCESSING", "READY"]);
    expect(result.video).toEqual({
      id: "video_1",
      status: "READY",
      durationMs: 7500,
      width: 1280,
      height: 720,
    });
    expect(serialized).not.toContain("storageKeyOriginal");
    expect(serialized).not.toContain("/private/storage");
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("DATABASE_URL");
  });

  it("marks the video failed when storage or ffprobe fails", async () => {
    const { repository, transitions } = createRepository(createVideo());

    await expect(
      processVideoJob(
        {
          videoId: "video_1",
        },
        {
          videoRepository: repository,
          storageResolver: {
            resolveOriginalObject: vi
              .fn()
              .mockRejectedValue(
                new VideoProcessingExpectedError("Object missing", "STORAGE_OBJECT_MISSING"),
              ),
          },
        },
      ),
    ).rejects.toThrow("Object missing");

    expect(transitions).toEqual(["PROCESSING", "FAILED"]);
    expect(repository.markFailed).toHaveBeenCalledWith("video_1", "STORAGE_OBJECT_MISSING");
  });

  it("rejects missing or wrong-status videos without status mutation", async () => {
    const missing = createRepository(null);
    const archived = createRepository(createVideo({ status: "ARCHIVED" }));

    await expect(
      processVideoJob(
        {
          videoId: "video_1",
        },
        {
          videoRepository: missing.repository,
          storageResolver: {
            resolveOriginalObject: vi.fn(),
          },
        },
      ),
    ).rejects.toMatchObject({ code: "VIDEO_NOT_FOUND" });
    await expect(
      processVideoJob(
        {
          videoId: "video_1",
        },
        {
          videoRepository: archived.repository,
          storageResolver: {
            resolveOriginalObject: vi.fn(),
          },
        },
      ),
    ).rejects.toMatchObject({ code: "VIDEO_NOT_PROCESSABLE" });

    expect(missing.transitions).toEqual([]);
    expect(archived.transitions).toEqual([]);
  });

  it("resolves local storage objects inside the configured root only", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "video-worker-"));
    const key = "shops/shop_1/videos/video_1/original/demo.mp4";
    await mkdir(path.dirname(path.join(root, key)), { recursive: true });
    await writeFile(path.join(root, key), "video bytes");
    const resolver = new LocalVideoStorageResolver(root);

    await expect(resolver.resolveOriginalObject(createVideo())).resolves.toBe(
      path.join(root, key),
    );
    await expect(
      resolver.resolveOriginalObject(createVideo({ storageKeyOriginal: "../secret.mp4" })),
    ).rejects.toMatchObject({ code: "STORAGE_KEY_INVALID" });
    await expect(
      resolver.resolveOriginalObject(createVideo({ storageKeyOriginal: "missing.mp4" })),
    ).rejects.toMatchObject({ code: "STORAGE_OBJECT_MISSING" });
  });
});
