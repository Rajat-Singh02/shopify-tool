import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { VideoRecord, VideoRepository } from "@shoppable-video/db";

const DEFAULT_UPLOAD_TTL_MS = 15 * 60 * 1000;

export type VideoUploadShop = {
  id: string;
  shopDomain: string;
};

export type VideoUploadIntentRequest = {
  filename?: unknown;
  contentType?: unknown;
  sizeBytes?: unknown;
};

export type VideoUploadEnvironment = {
  allowedVideoMimeTypes: string[];
  maxVideoSizeBytes: number;
  storageProvider: "local";
  localStorageRoot: string;
};

export type StorageWriteInput = {
  key: string;
  body: Uint8Array;
  contentType: string;
};

export type StorageProvider = {
  readonly name: "local";
  writeObject(input: StorageWriteInput): Promise<void>;
  objectExists(key: string): Promise<boolean>;
  objectSize(key: string): Promise<number | null>;
};

export type VideoProcessingDispatcher = {
  dispatchVideoProcessingJob(job: { videoId: string }): Promise<SafeVideoDto>;
};

export type UploadIntentResult = {
  video: SafeVideoDto;
  upload: {
    method: "PUT";
    url: string;
    headers: Record<string, string>;
    expiresAt: string;
  };
};

export type SafeVideoDto = {
  id: string;
  status: VideoRecord["status"];
  source: VideoRecord["source"];
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
};

export class VideoUploadExpectedError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly clientMessage = message,
  ) {
    super(message);
    this.name = "VideoUploadExpectedError";
  }
}

export class LocalStorageProvider implements StorageProvider {
  readonly name = "local" as const;
  private readonly root: string;

  constructor(root: string) {
    if (!root.trim()) {
      throw new VideoUploadExpectedError("Local storage root is not configured", 500);
    }

    this.root = path.resolve(root);
  }

  async writeObject({ key, body }: StorageWriteInput): Promise<void> {
    const objectPath = this.resolveObjectPath(key);

    await mkdir(path.dirname(objectPath), { recursive: true });
    await writeFile(objectPath, body);
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      const objectPath = this.resolveObjectPath(key);
      const objectStat = await stat(objectPath);

      return objectStat.isFile();
    } catch {
      return false;
    }
  }

  async objectSize(key: string): Promise<number | null> {
    try {
      const objectPath = this.resolveObjectPath(key);
      const objectStat = await stat(objectPath);

      return objectStat.isFile() ? objectStat.size : null;
    } catch {
      return null;
    }
  }

  async readObjectForTest(key: string): Promise<Buffer> {
    return readFile(this.resolveObjectPath(key));
  }

  private resolveObjectPath(key: string): string {
    assertSafeStorageKey(key);
    const objectPath = path.resolve(this.root, key);
    const relative = path.relative(this.root, objectPath);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new VideoUploadExpectedError("Invalid storage key", 400);
    }

    return objectPath;
  }
}

export function createStorageProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): StorageProvider {
  const uploadEnvironment = parseVideoUploadEnvironment(env);

  if (uploadEnvironment.storageProvider === "local") {
    return new LocalStorageProvider(uploadEnvironment.localStorageRoot);
  }

  throw new VideoUploadExpectedError("Unsupported storage provider", 500);
}

export function parseVideoUploadEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): VideoUploadEnvironment {
  const storageProvider = (env.STORAGE_PROVIDER ?? "local").trim().toLowerCase();

  if (storageProvider !== "local") {
    throw new VideoUploadExpectedError("Unsupported storage provider", 500);
  }

  return {
    allowedVideoMimeTypes: parseAllowedMimeTypes(env.ALLOWED_VIDEO_MIME_TYPES),
    maxVideoSizeBytes: parseMaxVideoSizeBytes(env.MAX_VIDEO_SIZE_MB),
    storageProvider,
    localStorageRoot:
      env.LOCAL_STORAGE_ROOT?.trim() || "/tmp/shoppable-video-storage",
  };
}

export async function createManualUploadIntent({
  request,
  shop,
  videoRepository,
  env = process.env,
}: {
  request: VideoUploadIntentRequest;
  shop: VideoUploadShop;
  videoRepository: Pick<VideoRepository, "createManualUpload">;
  env?: NodeJS.ProcessEnv;
}): Promise<UploadIntentResult> {
  const uploadEnvironment = parseVideoUploadEnvironment(env);
  const validated = validateUploadIntentRequest(request, uploadEnvironment);
  const videoId = randomUUID();
  const storageKeyOriginal = createOriginalVideoStorageKey({
    shopId: shop.id,
    videoId,
    filename: validated.filename,
  });
  const video = await videoRepository.createManualUpload({
    id: videoId,
    shopId: shop.id,
    originalFilename: validated.filename,
    originalMimeType: validated.contentType,
    originalSizeBytes: validated.sizeBytes,
    storageKeyOriginal,
  });

  return {
    video: toSafeVideoDto(video),
    upload: {
      method: "PUT",
      url: `/api/admin/videos/${encodeURIComponent(video.id)}/upload`,
      headers: {
        "Content-Type": validated.contentType,
      },
      expiresAt: new Date(Date.now() + DEFAULT_UPLOAD_TTL_MS).toISOString(),
    },
  };
}

export async function writeManualUploadObject({
  video,
  contentType,
  body,
  storageProvider,
  env = process.env,
}: {
  video: VideoRecord;
  contentType: string | null;
  body: Uint8Array;
  storageProvider: StorageProvider;
  env?: NodeJS.ProcessEnv;
}): Promise<SafeVideoDto> {
  const uploadEnvironment = parseVideoUploadEnvironment(env);

  if (!video.storageKeyOriginal) {
    throw new VideoUploadExpectedError("Video upload target is missing", 500);
  }

  if (contentType !== video.originalMimeType) {
    throw new VideoUploadExpectedError("Uploaded video content type does not match intent", 400);
  }

  if (!uploadEnvironment.allowedVideoMimeTypes.includes(contentType)) {
    throw new VideoUploadExpectedError("Unsupported video content type", 400);
  }

  if (body.byteLength <= 0) {
    throw new VideoUploadExpectedError("Uploaded video is empty", 400);
  }

  if (body.byteLength > uploadEnvironment.maxVideoSizeBytes) {
    throw new VideoUploadExpectedError("Uploaded video is too large", 400);
  }

  if (body.byteLength !== Number(video.originalSizeBytes)) {
    throw new VideoUploadExpectedError("Uploaded video size does not match intent", 400);
  }

  await storageProvider.writeObject({
    key: video.storageKeyOriginal,
    body,
    contentType,
  });

  return toSafeVideoDto(video);
}

export async function completeManualUpload({
  video,
  videoRepository,
  storageProvider,
  processingDispatcher,
}: {
  video: VideoRecord;
  videoRepository: Pick<VideoRepository, "markOriginalUploadComplete"> & {
    findById?: (videoId: string) => Promise<VideoRecord | null>;
  };
  storageProvider: StorageProvider;
  processingDispatcher?: VideoProcessingDispatcher;
}): Promise<SafeVideoDto> {
  if (video.status !== "UPLOADED") {
    return toSafeVideoDto(video);
  }

  if (!video.storageKeyOriginal) {
    throw new VideoUploadExpectedError("Video upload target is missing", 500);
  }

  const exists = await storageProvider.objectExists(video.storageKeyOriginal);

  if (!exists) {
    throw new VideoUploadExpectedError("Uploaded video object was not found", 400);
  }

  const storedSize = await storageProvider.objectSize(video.storageKeyOriginal);

  if (storedSize !== Number(video.originalSizeBytes)) {
    throw new VideoUploadExpectedError("Uploaded video size does not match intent", 400);
  }

  const completedVideo = await videoRepository.markOriginalUploadComplete(video);

  if (!processingDispatcher) {
    return toSafeVideoDto(completedVideo);
  }

  try {
    return await processingDispatcher.dispatchVideoProcessingJob({
      videoId: completedVideo.id,
    });
  } catch {
    const latestVideo = await videoRepository.findById?.(completedVideo.id);

    if (latestVideo) {
      return toSafeVideoDto(latestVideo);
    }

    return toSafeVideoDto(completedVideo);
  }
}

export function toSafeVideoDto(video: VideoRecord): SafeVideoDto {
  return {
    id: video.id,
    status: video.status,
    source: video.source,
    originalFilename: video.originalFilename,
    contentType: video.originalMimeType,
    sizeBytes: Number(video.originalSizeBytes),
  };
}

function validateUploadIntentRequest(
  request: VideoUploadIntentRequest,
  env: VideoUploadEnvironment,
) {
  const filename = validateOriginalFilename(request.filename);
  const contentType = validateContentType(request.contentType, env.allowedVideoMimeTypes);
  const sizeBytes = validateSizeBytes(request.sizeBytes, env.maxVideoSizeBytes);

  return {
    filename,
    contentType,
    sizeBytes,
  };
}

function validateOriginalFilename(value: unknown): string {
  if (typeof value !== "string") {
    throw new VideoUploadExpectedError("filename is required", 400);
  }

  const trimmed = value.trim();

  if (
    !trimmed ||
    trimmed.includes("\0") ||
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed.includes("..")
  ) {
    throw new VideoUploadExpectedError("filename is invalid", 400);
  }

  return trimmed.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 160);
}

function validateContentType(value: unknown, allowedVideoMimeTypes: string[]): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new VideoUploadExpectedError("contentType is required", 400);
  }

  const contentType = value.trim().toLowerCase();

  if (!allowedVideoMimeTypes.includes(contentType)) {
    throw new VideoUploadExpectedError("Unsupported video content type", 400);
  }

  return contentType;
}

function validateSizeBytes(value: unknown, maxVideoSizeBytes: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new VideoUploadExpectedError("sizeBytes must be a positive integer", 400);
  }

  if (value > maxVideoSizeBytes) {
    throw new VideoUploadExpectedError("Uploaded video is too large", 400);
  }

  return value;
}

function parseAllowedMimeTypes(value: string | undefined): string[] {
  const allowedMimeTypes = (value ?? "video/mp4,video/quicktime,video/webm")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (allowedMimeTypes.length === 0) {
    throw new VideoUploadExpectedError("Allowed video MIME types are not configured", 500);
  }

  return allowedMimeTypes;
}

function parseMaxVideoSizeBytes(value: string | undefined): number {
  const maxVideoSizeMb = Number(value ?? "500");

  if (!Number.isFinite(maxVideoSizeMb) || maxVideoSizeMb <= 0) {
    throw new VideoUploadExpectedError("Maximum video size is not configured", 500);
  }

  return Math.floor(maxVideoSizeMb * 1024 * 1024);
}

function createOriginalVideoStorageKey({
  shopId,
  videoId,
  filename,
}: {
  shopId: string;
  videoId: string;
  filename: string;
}): string {
  const key = `shops/${shopId}/videos/${videoId}/original/${filename}`;

  assertSafeStorageKey(key);

  return key;
}

export function assertSafeStorageKey(key: string): void {
  if (
    !key ||
    key.includes("\0") ||
    key.includes("\\") ||
    key.split("/").some((segment) => !segment || segment === "." || segment === "..") ||
    path.isAbsolute(key)
  ) {
    throw new VideoUploadExpectedError("Invalid storage key", 400);
  }
}
