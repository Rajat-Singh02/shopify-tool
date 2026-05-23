import { randomUUID } from "node:crypto";

export type VideoRecord = {
  id: string;
  shopId: string;
  source: "MANUAL_UPLOAD";
  originalFilename: string;
  originalMimeType: string;
  originalSizeBytes: bigint;
  status: "UPLOADED" | "PROCESSING" | "READY" | "FAILED" | "ARCHIVED";
  storageKeyOriginal: string | null;
  storageKeyOptimized: string | null;
  playbackUrl: string | null;
  thumbnailUrl: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type VideoStatus = VideoRecord["status"];
export type VideoSource = VideoRecord["source"];

type VideoWhereInput = {
  id?: string | { lt: string };
  shopId?: string;
  status?: VideoStatus;
  source?: VideoSource;
  originalFilename?: {
    contains: string;
    mode: "insensitive";
  };
  OR?: VideoWhereInput[];
  AND?: VideoWhereInput[];
  createdAt?: {
    lt?: Date;
    equals?: Date;
  };
};

export type VideoRepositoryClient = {
  video: {
    create(args: {
      data: {
        id: string;
        shopId: string;
        source: "MANUAL_UPLOAD";
        originalFilename: string;
        originalMimeType: string;
        originalSizeBytes: bigint;
        status: "UPLOADED";
        storageKeyOriginal: string;
      };
    }): Promise<VideoRecord>;
    findUnique(args: { where: { id: string } }): Promise<VideoRecord | null>;
    findFirst(args: { where: VideoWhereInput }): Promise<VideoRecord | null>;
    findMany(args: {
      where: VideoWhereInput;
      orderBy: Array<{ createdAt: "desc" } | { id: "desc" }>;
      take: number;
    }): Promise<VideoRecord[]>;
    update(args: {
      where: { id: string };
      data:
        | {
            status: "UPLOADED";
            storageKeyOriginal?: string;
          }
        | {
            status: "PROCESSING";
            failureReason: null;
          }
        | {
            status: "READY";
            durationMs: number | null;
            width: number | null;
            height: number | null;
            failureReason: null;
          }
        | {
            status: "FAILED";
            failureReason: string;
          }
        | {
            status: "ARCHIVED";
          };
    }): Promise<VideoRecord>;
  };
};

export type VideoMetadataUpdate = {
  durationMs: number | null;
  width: number | null;
  height: number | null;
};

export type VideoProcessingRepositoryClient = {
  video: {
    findUnique(args: { where: { id: string } }): Promise<VideoRecord | null>;
    update(args: {
      where: { id: string };
      data:
        | {
            status: "PROCESSING";
            failureReason: null;
          }
        | {
            status: "READY";
            durationMs: number | null;
            width: number | null;
            height: number | null;
            failureReason: null;
          }
        | {
            status: "FAILED";
            failureReason: string;
          };
    }): Promise<VideoRecord>;
  };
};

export type VideoUploadRepositoryClient = {
  video: {
    create(args: {
      data: {
        id: string;
        shopId: string;
        source: "MANUAL_UPLOAD";
        originalFilename: string;
        originalMimeType: string;
        originalSizeBytes: bigint;
        status: "UPLOADED";
        storageKeyOriginal?: string;
      };
    }): Promise<VideoRecord>;
  };
};

export type CreateManualUploadVideoInput = {
  shopId: string;
  originalFilename: string;
  originalMimeType: string;
  originalSizeBytes: number;
  storageKeyOriginal: string;
  id?: string;
};

export type ListVideosInput = {
  shopId: string;
  first: number;
  after?: string | null;
  status?: VideoStatus | null;
  source?: VideoSource | null;
  q?: string | null;
};

export type ListVideosResult = {
  videos: VideoRecord[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
};

type VideoCursor = {
  createdAt: string;
  id: string;
};

export class VideoRepository {
  constructor(private readonly client: VideoRepositoryClient) {}

  async createManualUpload(input: CreateManualUploadVideoInput): Promise<VideoRecord> {
    return this.client.video.create({
      data: {
        id: input.id ?? randomUUID(),
        shopId: input.shopId,
        source: "MANUAL_UPLOAD",
        originalFilename: input.originalFilename,
        originalMimeType: input.originalMimeType,
        originalSizeBytes: BigInt(input.originalSizeBytes),
        status: "UPLOADED",
        storageKeyOriginal: input.storageKeyOriginal,
      },
    });
  }

  async findOwnedVideo(shopId: string, videoId: string): Promise<VideoRecord | null> {
    return this.client.video.findFirst({
      where: {
        id: videoId,
        shopId,
      },
    });
  }

  async listByShop(input: ListVideosInput): Promise<ListVideosResult> {
    const where = createListVideosWhere(input);
    const videos = await this.client.video.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.first + 1,
    });
    const visibleVideos = videos.slice(0, input.first);
    const lastVideo = visibleVideos.at(-1);

    return {
      videos: visibleVideos,
      pageInfo: {
        hasNextPage: videos.length > input.first,
        endCursor: lastVideo ? encodeVideoCursor(lastVideo) : null,
      },
    };
  }

  async findByShop(shopId: string, videoId: string): Promise<VideoRecord | null> {
    return this.findOwnedVideo(shopId, videoId);
  }

  async findById(videoId: string): Promise<VideoRecord | null> {
    return this.client.video.findUnique({
      where: {
        id: videoId,
      },
    });
  }

  async markOriginalUploadComplete(video: VideoRecord): Promise<VideoRecord> {
    if (!video.storageKeyOriginal) {
      throw new Error("Video original storage key is missing");
    }

    return this.client.video.update({
      where: {
        id: video.id,
      },
      data: {
        status: "UPLOADED",
        storageKeyOriginal: video.storageKeyOriginal,
      },
    });
  }

  async markProcessing(videoId: string): Promise<VideoRecord> {
    return this.client.video.update({
      where: {
        id: videoId,
      },
      data: {
        status: "PROCESSING",
        failureReason: null,
      },
    });
  }

  async markReady(videoId: string, metadata: VideoMetadataUpdate): Promise<VideoRecord> {
    return this.client.video.update({
      where: {
        id: videoId,
      },
      data: {
        status: "READY",
        durationMs: metadata.durationMs,
        width: metadata.width,
        height: metadata.height,
        failureReason: null,
      },
    });
  }

  async markFailed(videoId: string, failureReason: string): Promise<VideoRecord> {
    return this.client.video.update({
      where: {
        id: videoId,
      },
      data: {
        status: "FAILED",
        failureReason: sanitizeFailureReason(failureReason),
      },
    });
  }

  async archiveByShop(shopId: string, videoId: string): Promise<VideoRecord | null> {
    const video = await this.findByShop(shopId, videoId);

    if (!video) {
      return null;
    }

    if (video.status === "ARCHIVED") {
      return video;
    }

    return this.client.video.update({
      where: {
        id: videoId,
      },
      data: {
        status: "ARCHIVED",
      },
    });
  }
}

function sanitizeFailureReason(failureReason: string): string {
  return failureReason.replace(/[\r\n\t]/g, " ").slice(0, 240);
}

function createListVideosWhere(input: ListVideosInput): VideoWhereInput {
  const where: VideoWhereInput = {
    shopId: input.shopId,
  };
  const cursor = input.after ? decodeVideoCursor(input.after) : null;

  if (input.status) {
    where.status = input.status;
  }

  if (input.source) {
    where.source = input.source;
  }

  if (input.q) {
    where.originalFilename = {
      contains: input.q,
      mode: "insensitive",
    };
  }

  if (cursor) {
    const cursorCreatedAt = new Date(cursor.createdAt);
    where.AND = [
      {
        OR: [
          {
            createdAt: {
              lt: cursorCreatedAt,
            },
          },
          {
            createdAt: {
              equals: cursorCreatedAt,
            },
            id: {
              lt: cursor.id,
            },
          },
        ],
      },
    ];
  }

  return where;
}

function encodeVideoCursor(video: VideoRecord): string {
  const cursor: VideoCursor = {
    createdAt: video.createdAt.toISOString(),
    id: video.id,
  };

  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeVideoCursor(cursor: string): VideoCursor | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;

    if (!decoded || typeof decoded !== "object") {
      return null;
    }

    const record = decoded as Record<string, unknown>;

    if (typeof record.createdAt !== "string" || typeof record.id !== "string") {
      return null;
    }

    const createdAt = new Date(record.createdAt);

    if (Number.isNaN(createdAt.valueOf())) {
      return null;
    }

    return {
      createdAt: createdAt.toISOString(),
      id: record.id,
    };
  } catch {
    return null;
  }
}
