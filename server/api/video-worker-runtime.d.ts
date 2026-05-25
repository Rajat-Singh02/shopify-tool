declare module "@shoppable-video/video-worker" {
  import type { VideoRecord, VideoRepository } from "@shoppable-video/db";

  export type VideoStorageResolver = {
    resolveOriginalObject(video: VideoRecord): Promise<string>;
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

  export class VideoProcessingExpectedError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
  }

  export function createLocalVideoStorageResolverFromEnv(
    env?: NodeJS.ProcessEnv,
  ): VideoStorageResolver;

  export function createUnknownVideoMetadata(): VideoMetadata;

  export function extractVideoMetadata(
    filePath: string,
    options?: {
      ffprobePath?: string;
      timeoutMs?: number;
    },
  ): Promise<VideoMetadata>;

  export function processVideoJob(
    job: { videoId: string },
    dependencies: {
      videoRepository: Pick<VideoRepository, "findById" | "markProcessing" | "markReady" | "markFailed"> & {
        tryClaimProcessing?: (videoId: string) => Promise<VideoRecord | null>;
      };
      storageResolver: VideoStorageResolver;
      extractMetadata?: (filePath: string) => Promise<VideoMetadata>;
    },
  ): Promise<unknown>;
}
