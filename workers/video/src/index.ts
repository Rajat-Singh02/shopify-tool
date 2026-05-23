import { execFile as execFileCallback } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { VideoRecord, VideoRepository } from "@shoppable-video/db";

const execFile = promisify(execFileCallback);
const DEFAULT_FFPROBE_TIMEOUT_MS = 15_000;

export type VideoWorkerHealth = {
  ok: true;
  ffmpegRequired: true;
};

export type VideoProcessingJob = {
  videoId: string;
};

export type VideoMetadata = {
  durationSeconds: number | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  formatName: string | null;
  videoCodec: string | null;
  bitrate: number | null;
};

export type VideoProcessingResult = {
  video: {
    id: string;
    status: VideoRecord["status"];
    durationMs: number | null;
    width: number | null;
    height: number | null;
  };
  metadata: VideoMetadata;
};

export type VideoStorageResolver = {
  resolveOriginalObject(video: VideoRecord): Promise<string>;
};

export type FfprobeExecutor = (
  filePath: string,
  options: { ffprobePath: string; timeoutMs: number },
) => Promise<string>;

export type VideoProcessingDependencies = {
  videoRepository: Pick<VideoRepository, "findById" | "markProcessing" | "markReady" | "markFailed"> & {
    tryClaimProcessing?: (videoId: string) => Promise<VideoRecord | null>;
  };
  storageResolver: VideoStorageResolver;
  extractMetadata?: (filePath: string) => Promise<VideoMetadata>;
};

export class VideoProcessingExpectedError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "VideoProcessingExpectedError";
  }
}

export function getVideoWorkerHealth(): VideoWorkerHealth {
  return {
    ok: true,
    ffmpegRequired: true,
  };
}

export async function processVideoJob(
  job: VideoProcessingJob,
  {
    videoRepository,
    storageResolver,
    extractMetadata = extractVideoMetadata,
  }: VideoProcessingDependencies,
): Promise<VideoProcessingResult> {
  const video = await videoRepository.findById(job.videoId);

  if (!video) {
    throw new VideoProcessingExpectedError("Video was not found", "VIDEO_NOT_FOUND");
  }

  if (video.status !== "UPLOADED") {
    throw new VideoProcessingExpectedError(
      "Video is not ready for processing",
      "VIDEO_NOT_PROCESSABLE",
    );
  }

  const claimedVideo = videoRepository.tryClaimProcessing
    ? await videoRepository.tryClaimProcessing(video.id)
    : await videoRepository.markProcessing(video.id);

  if (!claimedVideo) {
    throw new VideoProcessingExpectedError(
      "Video is already claimed for processing",
      "VIDEO_PROCESSING_ALREADY_CLAIMED",
    );
  }

  try {
    const originalObjectPath = await storageResolver.resolveOriginalObject(video);
    const metadata = await extractMetadata(originalObjectPath);
    const readyVideo = await videoRepository.markReady(video.id, {
      durationMs: metadata.durationMs,
      width: metadata.width,
      height: metadata.height,
    });

    return {
      video: {
        id: readyVideo.id,
        status: readyVideo.status,
        durationMs: readyVideo.durationMs,
        width: readyVideo.width,
        height: readyVideo.height,
      },
      metadata,
    };
  } catch (error) {
    try {
      await videoRepository.markFailed(video.id, toSafeProcessingFailureReason(error));
    } catch {
      // Preserve the original processing error; a failed failure-mark update should not mask it.
    }

    throw error;
  }
}

export async function extractVideoMetadata(
  filePath: string,
  {
    ffprobePath = process.env.FFPROBE_PATH || "ffprobe",
    timeoutMs = DEFAULT_FFPROBE_TIMEOUT_MS,
    runFfprobe = defaultRunFfprobe,
  }: {
    ffprobePath?: string;
    timeoutMs?: number;
    runFfprobe?: FfprobeExecutor;
  } = {},
): Promise<VideoMetadata> {
  const rawOutput = await runFfprobe(filePath, { ffprobePath, timeoutMs });

  return parseFfprobeMetadata(rawOutput);
}

export function parseFfprobeMetadata(rawOutput: string): VideoMetadata {
  let payload: unknown;

  try {
    payload = JSON.parse(rawOutput) as unknown;
  } catch {
    throw new VideoProcessingExpectedError("ffprobe returned invalid JSON", "FFPROBE_INVALID_JSON");
  }

  if (!payload || typeof payload !== "object") {
    throw new VideoProcessingExpectedError("ffprobe returned invalid output", "FFPROBE_INVALID_OUTPUT");
  }

  const record = payload as {
    format?: {
      duration?: unknown;
      format_name?: unknown;
      bit_rate?: unknown;
    };
    streams?: Array<{
      codec_type?: unknown;
      codec_name?: unknown;
      width?: unknown;
      height?: unknown;
      duration?: unknown;
      bit_rate?: unknown;
    }>;
  };
  const videoStream = record.streams?.find((stream) => stream.codec_type === "video");

  if (!videoStream) {
    throw new VideoProcessingExpectedError("ffprobe did not find a video stream", "VIDEO_STREAM_MISSING");
  }

  const durationSeconds =
    toNullablePositiveNumber(videoStream.duration) ??
    toNullablePositiveNumber(record.format?.duration);

  return {
    durationSeconds,
    durationMs: durationSeconds === null ? null : Math.round(durationSeconds * 1000),
    width: toNullablePositiveInteger(videoStream.width),
    height: toNullablePositiveInteger(videoStream.height),
    formatName: toNullableString(record.format?.format_name),
    videoCodec: toNullableString(videoStream.codec_name),
    bitrate:
      toNullablePositiveInteger(videoStream.bit_rate) ??
      toNullablePositiveInteger(record.format?.bit_rate),
  };
}

export class LocalVideoStorageResolver implements VideoStorageResolver {
  private readonly root: string;

  constructor(root: string) {
    if (!root.trim()) {
      throw new VideoProcessingExpectedError(
        "Local storage root is not configured",
        "STORAGE_ROOT_MISSING",
      );
    }

    this.root = path.resolve(root);
  }

  async resolveOriginalObject(video: VideoRecord): Promise<string> {
    if (!video.storageKeyOriginal) {
      throw new VideoProcessingExpectedError(
        "Video original storage key is missing",
        "STORAGE_KEY_MISSING",
      );
    }

    const objectPath = this.resolveObjectPath(video.storageKeyOriginal);
    let objectStat: Awaited<ReturnType<typeof stat>>;

    try {
      objectStat = await stat(objectPath);
    } catch {
      throw new VideoProcessingExpectedError("Video original object is missing", "STORAGE_OBJECT_MISSING");
    }

    if (!objectStat.isFile()) {
      throw new VideoProcessingExpectedError("Video original object is missing", "STORAGE_OBJECT_MISSING");
    }

    return objectPath;
  }

  private resolveObjectPath(key: string): string {
    assertSafeStorageKey(key);
    const objectPath = path.resolve(this.root, key);
    const relative = path.relative(this.root, objectPath);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new VideoProcessingExpectedError("Invalid storage key", "STORAGE_KEY_INVALID");
    }

    return objectPath;
  }
}

export function createLocalVideoStorageResolverFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): LocalVideoStorageResolver {
  return new LocalVideoStorageResolver(env.LOCAL_STORAGE_ROOT || "/tmp/shoppable-video-storage");
}

async function defaultRunFfprobe(
  filePath: string,
  { ffprobePath, timeoutMs }: { ffprobePath: string; timeoutMs: number },
): Promise<string> {
  const { stdout } = await execFile(
    ffprobePath,
    [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      "--",
      filePath,
    ],
    {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    },
  );

  return stdout;
}

function assertSafeStorageKey(key: string): void {
  if (
    !key ||
    key.includes("\0") ||
    key.includes("\\") ||
    key.split("/").some((segment) => !segment || segment === "." || segment === "..") ||
    path.isAbsolute(key)
  ) {
    throw new VideoProcessingExpectedError("Invalid storage key", "STORAGE_KEY_INVALID");
  }
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toNullablePositiveNumber(value: unknown): number | null {
  const number = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;

  return Number.isFinite(number) && number > 0 ? number : null;
}

function toNullablePositiveInteger(value: unknown): number | null {
  const number = toNullablePositiveNumber(value);

  return number === null ? null : Math.round(number);
}

function toSafeProcessingFailureReason(error: unknown): string {
  if (error instanceof VideoProcessingExpectedError) {
    return error.code;
  }

  if (error instanceof Error && error.name) {
    return error.name;
  }

  return "VIDEO_PROCESSING_FAILED";
}
