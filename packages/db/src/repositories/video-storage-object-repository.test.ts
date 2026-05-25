import { describe, expect, it } from "vitest";

import {
  VideoStorageObjectRepository,
  type VideoStorageObjectRepositoryClient,
  type VideoStorageObjectRecord,
} from "./video-storage-object-repository.js";

describe("VideoStorageObjectRepository", () => {
  it("writes and reads video storage objects without exposing filesystem details", async () => {
    const rows = new Map<string, VideoStorageObjectRecord>();
    type UpsertArgs = Parameters<
      VideoStorageObjectRepositoryClient["videoStorageObject"]["upsert"]
    >[0];
    type FindUniqueArgs = Parameters<
      VideoStorageObjectRepositoryClient["videoStorageObject"]["findUnique"]
    >[0];
    const client: VideoStorageObjectRepositoryClient = {
      videoStorageObject: {
        upsert(args: UpsertArgs) {
          const now = new Date("2026-05-23T00:00:00.000Z");
          const row = rows.has(args.where.key)
            ? {
                ...rows.get(args.where.key)!,
                ...args.update,
                updatedAt: now,
              }
            : {
                ...args.create,
                createdAt: now,
                updatedAt: now,
              };

          rows.set(args.where.key, row);

          return Promise.resolve(row);
        },
        findUnique(args: FindUniqueArgs) {
          const row = rows.get(args.where.key);

          if (!row) {
            return Promise.resolve(null);
          }

          if (!args.select) {
            return Promise.resolve(row);
          }

          const selected = Object.fromEntries(
            Object.entries(args.select)
              .filter(([, enabled]) => enabled)
              .map(([key]) => [key, row[key as keyof typeof row]]),
          );

          return Promise.resolve(selected);
        },
      },
    };
    const repository = new VideoStorageObjectRepository(client);

    await repository.writeObject({
      key: "shops/shop_1/videos/video_1/original/demo.mp4",
      contentType: "video/mp4",
      body: new Uint8Array([1, 2, 3, 4]),
    });

    await expect(repository.objectExists("shops/shop_1/videos/video_1/original/demo.mp4")).resolves
      .toBe(true);
    await expect(repository.objectSize("shops/shop_1/videos/video_1/original/demo.mp4")).resolves
      .toBe(4);
    await expect(repository.readObject("shops/shop_1/videos/video_1/original/demo.mp4")).resolves
      .toMatchObject({
        key: "shops/shop_1/videos/video_1/original/demo.mp4",
        contentType: "video/mp4",
        sizeBytes: 4,
        body: new Uint8Array([1, 2, 3, 4]),
      });
  });
});
