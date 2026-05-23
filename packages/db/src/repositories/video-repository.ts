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
    findFirst(args: { where: { id: string; shopId: string } }): Promise<VideoRecord | null>;
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
}

function sanitizeFailureReason(failureReason: string): string {
  return failureReason.replace(/[\r\n\t]/g, " ").slice(0, 240);
}
