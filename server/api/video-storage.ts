import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  getPrismaClient,
  VideoStorageObjectRepository,
  type ReadVideoStorageObjectResult,
  type VideoRecord,
} from "@shoppable-video/db";
import {
  createLocalVideoStorageResolverFromEnv,
  VideoProcessingExpectedError,
  type VideoStorageResolver,
} from "@shoppable-video/video-worker";

import type { StorefrontMediaStorageResolver } from "./storefront-media.js";
import { assertSafeStorageKey, VideoUploadExpectedError } from "./video-upload.js";

type StorageProviderName = "local" | "database";

export function createVideoStorageResolverFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): VideoStorageResolver {
  const storageProvider = parseStorageProviderName(env);

  if (storageProvider === "local") {
    return createLocalVideoStorageResolverFromEnv(env);
  }

  return new DatabaseVideoProcessingStorageResolver({
    tempRoot: env.VIDEO_PROCESSING_TEMP_ROOT || path.join(tmpdir(), "shoppable-video-processing"),
  });
}

export function createStorefrontMediaStorageResolverFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): StorefrontMediaStorageResolver {
  const storageProvider = parseStorageProviderName(env);

  if (storageProvider === "local") {
    return createLocalVideoStorageResolverFromEnv(env);
  }

  return new DatabaseStorefrontMediaStorageResolver();
}

export class DatabaseStorefrontMediaStorageResolver implements StorefrontMediaStorageResolver {
  constructor(
    private readonly repository: Pick<
      VideoStorageObjectRepository,
      "readObject"
    > = new VideoStorageObjectRepository(getPrismaClient()),
  ) {}

  async resolveOriginalObject(video: VideoRecord) {
    const object = await readDatabaseVideoObject(video, this.repository);

    return {
      kind: "bytes" as const,
      body: object.body,
      contentType: object.contentType,
      sizeBytes: object.sizeBytes,
    };
  }
}

export class DatabaseVideoProcessingStorageResolver implements VideoStorageResolver {
  private readonly tempRoot: string;

  constructor(
    { tempRoot }: { tempRoot: string },
    private readonly repository: Pick<
      VideoStorageObjectRepository,
      "readObject"
    > = new VideoStorageObjectRepository(getPrismaClient()),
  ) {
    if (!tempRoot.trim()) {
      throw new VideoProcessingExpectedError(
        "Video processing temp root is not configured",
        "STORAGE_ROOT_MISSING",
      );
    }

    this.tempRoot = path.resolve(tempRoot);
  }

  async resolveOriginalObject(video: VideoRecord): Promise<string> {
    const object = await readDatabaseVideoObject(video, this.repository);
    const objectPath = this.resolveTempObjectPath(video);

    await mkdir(path.dirname(objectPath), { recursive: true });
    await writeFile(objectPath, object.body);

    return objectPath;
  }

  private resolveTempObjectPath(video: VideoRecord): string {
    const safeFilename = sanitizeTempFilename(video.originalFilename);
    const objectPath = path.resolve(this.tempRoot, video.id, safeFilename);
    const relative = path.relative(this.tempRoot, objectPath);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new VideoProcessingExpectedError("Invalid storage key", "STORAGE_KEY_INVALID");
    }

    return objectPath;
  }
}

async function readDatabaseVideoObject(
  video: VideoRecord,
  repository: Pick<VideoStorageObjectRepository, "readObject">,
): Promise<ReadVideoStorageObjectResult> {
  if (!video.storageKeyOriginal) {
    throw new VideoProcessingExpectedError(
      "Video original storage key is missing",
      "STORAGE_KEY_MISSING",
    );
  }

  assertSafeStorageKey(video.storageKeyOriginal);

  const object = await repository.readObject(video.storageKeyOriginal);

  if (!object || object.sizeBytes !== Number(video.originalSizeBytes)) {
    throw new VideoProcessingExpectedError("Video original object is missing", "STORAGE_OBJECT_MISSING");
  }

  return object;
}

function parseStorageProviderName(env: NodeJS.ProcessEnv): StorageProviderName {
  const storageProvider = (env.STORAGE_PROVIDER ?? "local").trim().toLowerCase();

  if (storageProvider !== "local" && storageProvider !== "database") {
    throw new VideoUploadExpectedError("Unsupported storage provider", 500);
  }

  return storageProvider;
}

function sanitizeTempFilename(filename: string): string {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);

  return safeFilename || "video-upload";
}
