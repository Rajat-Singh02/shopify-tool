declare module "@shoppable-video/video-worker" {
  import type { VideoRecord, VideoRepository } from "@shoppable-video/db";

  export type VideoStorageResolver = {
    resolveOriginalObject(video: VideoRecord): Promise<string>;
  };

  export function createLocalVideoStorageResolverFromEnv(
    env?: NodeJS.ProcessEnv,
  ): VideoStorageResolver;

  export function processVideoJob(
    job: { videoId: string },
    dependencies: {
      videoRepository: Pick<VideoRepository, "findById" | "markProcessing" | "markReady" | "markFailed"> & {
        tryClaimProcessing?: (videoId: string) => Promise<VideoRecord | null>;
      };
      storageResolver: VideoStorageResolver;
    },
  ): Promise<unknown>;
}
