import type {
  ListVideosInput,
  VideoRecord,
  VideoRepository,
  VideoSource,
  VideoStatus,
} from "@shoppable-video/db";

import type { VideoUploadShop } from "./video-upload.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_QUERY_LENGTH = 80;
const MAX_CURSOR_LENGTH = 512;
const VIDEO_STATUSES = new Set<VideoStatus>([
  "UPLOADED",
  "PROCESSING",
  "READY",
  "FAILED",
  "ARCHIVED",
]);
const VIDEO_SOURCES = new Set<VideoSource>(["MANUAL_UPLOAD"]);

export type SafeVideoLibraryDto = {
  id: string;
  source: VideoSource;
  status: VideoStatus;
  originalFilename: string;
  contentType: string;
  sizeBytes: number | string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
};

export type VideoLibraryListResponse = {
  videos: SafeVideoLibraryDto[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
};

export type VideoLibraryListQuery = {
  first?: unknown;
  after?: unknown;
  status?: unknown;
  source?: unknown;
  q?: unknown;
};

export class VideoLibraryExpectedError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly clientMessage = message,
  ) {
    super(message);
    this.name = "VideoLibraryExpectedError";
  }
}

export async function listVideoLibrary({
  shop,
  query,
  videoRepository,
}: {
  shop: VideoUploadShop;
  query: VideoLibraryListQuery;
  videoRepository: Pick<VideoRepository, "listByShop">;
}): Promise<VideoLibraryListResponse> {
  const input = parseVideoLibraryListInput(shop.id, query);
  const result = await videoRepository.listByShop(input);

  return {
    videos: result.videos.map(toSafeVideoLibraryDto),
    pageInfo: result.pageInfo,
  };
}

export async function getVideoLibraryDetail({
  shop,
  videoId,
  videoRepository,
}: {
  shop: VideoUploadShop;
  videoId: string;
  videoRepository: Pick<VideoRepository, "findByShop">;
}): Promise<SafeVideoLibraryDto> {
  const video = await videoRepository.findByShop(shop.id, validateVideoId(videoId));

  if (!video) {
    throw new VideoLibraryExpectedError("Video was not found", 404);
  }

  return toSafeVideoLibraryDto(video);
}

export async function archiveVideoLibraryItem({
  shop,
  videoId,
  videoRepository,
}: {
  shop: VideoUploadShop;
  videoId: string;
  videoRepository: Pick<VideoRepository, "archiveByShop">;
}): Promise<SafeVideoLibraryDto> {
  const video = await videoRepository.archiveByShop(shop.id, validateVideoId(videoId));

  if (!video) {
    throw new VideoLibraryExpectedError("Video was not found", 404);
  }

  return toSafeVideoLibraryDto(video);
}

export function toSafeVideoLibraryDto(video: VideoRecord): SafeVideoLibraryDto {
  return {
    id: video.id,
    source: video.source,
    status: video.status,
    originalFilename: video.originalFilename,
    contentType: video.originalMimeType,
    sizeBytes:
      video.originalSizeBytes <= BigInt(Number.MAX_SAFE_INTEGER)
        ? Number(video.originalSizeBytes)
        : video.originalSizeBytes.toString(),
    durationMs: video.durationMs,
    width: video.width,
    height: video.height,
    createdAt: video.createdAt.toISOString(),
    updatedAt: video.updatedAt.toISOString(),
  };
}

function parseVideoLibraryListInput(
  shopId: string,
  query: VideoLibraryListQuery,
): ListVideosInput {
  const first = parseFirst(query.first);
  const after = parseCursor(query.after);
  const status = parseStatus(query.status);
  const source = parseSource(query.source);
  const q = parseSearchQuery(query.q);

  return {
    shopId,
    first,
    after,
    status,
    source,
    q,
  };
}

function parseFirst(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_PAGE_SIZE;
  }

  const first = Number(value);

  if (!Number.isInteger(first) || first <= 0) {
    throw new VideoLibraryExpectedError("first must be a positive integer", 400);
  }

  return Math.min(first, MAX_PAGE_SIZE);
}

function parseCursor(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || value.length > MAX_CURSOR_LENGTH || !isValidVideoCursor(value)) {
    throw new VideoLibraryExpectedError("after cursor is invalid", 400);
  }

  return value;
}

function isValidVideoCursor(cursor: string): boolean {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;

    if (!decoded || typeof decoded !== "object") {
      return false;
    }

    const record = decoded as Record<string, unknown>;

    if (typeof record.createdAt !== "string" || typeof record.id !== "string") {
      return false;
    }

    return !Number.isNaN(new Date(record.createdAt).valueOf()) && record.id.length > 0;
  } catch {
    return false;
  }
}

function parseStatus(value: unknown): VideoStatus | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || !VIDEO_STATUSES.has(value as VideoStatus)) {
    throw new VideoLibraryExpectedError("status filter is invalid", 400);
  }

  return value as VideoStatus;
}

function parseSource(value: unknown): VideoSource | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || !VIDEO_SOURCES.has(value as VideoSource)) {
    throw new VideoLibraryExpectedError("source filter is invalid", 400);
  }

  return value as VideoSource;
}

function parseSearchQuery(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new VideoLibraryExpectedError("q filter is invalid", 400);
  }

  const q = value.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);

  return q || null;
}

function validateVideoId(videoId: string): string {
  if (!videoId.trim() || videoId.length > 160 || videoId.includes("/")) {
    throw new VideoLibraryExpectedError("Video was not found", 404);
  }

  return videoId;
}
