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
    findFirst(args: { where: { id: string; shopId: string } }): Promise<VideoRecord | null>;
    update(args: {
      where: { id: string };
      data: {
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
}
