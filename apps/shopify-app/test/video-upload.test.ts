import { describe, expect, it, vi } from "vitest";

import {
  MAX_VIDEO_SIZE_BYTES,
  uploadManualVideo,
  validateVideoFile,
  VIDEO_UPLOAD_INTENT_PATH,
  VIDEO_UPLOAD_SAFE_ERROR_MESSAGE,
} from "../services/video-upload";

function createVideoFile(type = "video/mp4", size = 4): File {
  const file = new File([new Uint8Array(size)], "demo.mp4", { type });

  Object.defineProperty(file, "size", {
    value: size,
  });

  return file;
}

describe("uploadManualVideo", () => {
  it("creates intent, uploads the file, and completes upload with App Bridge auth", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          {
            video: {
              id: "video_1",
              status: "UPLOADED",
              source: "MANUAL_UPLOAD",
              originalFilename: "demo.mp4",
              contentType: "video/mp4",
              sizeBytes: 4,
            },
            upload: {
              method: "PUT",
              url: "/api/admin/videos/video_1/upload",
              headers: {
                "Content-Type": "video/mp4",
              },
              expiresAt: "2026-05-23T00:15:00.000Z",
            },
          },
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(Response.json({ video: { id: "video_1" } }))
      .mockResolvedValueOnce(
        Response.json({
          video: {
            id: "video_1",
            status: "UPLOADED",
            source: "MANUAL_UPLOAD",
            originalFilename: "demo.mp4",
            contentType: "video/mp4",
            sizeBytes: 4,
          },
        }),
      );

    const result = await uploadManualVideo(
      createVideoFile(),
      fetcher,
      () => Promise.resolve("shopify-id-token"),
    );
    const intentHeaders = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
    const uploadHeaders = new Headers(fetcher.mock.calls[1]?.[1]?.headers);
    const completeHeaders = new Headers(fetcher.mock.calls[2]?.[1]?.headers);

    expect(result.video.id).toBe("video_1");
    expect(fetcher.mock.calls[0]?.[0]).toBe(VIDEO_UPLOAD_INTENT_PATH);
    expect(fetcher.mock.calls[1]?.[0]).toBe("/api/admin/videos/video_1/upload");
    expect(fetcher.mock.calls[2]?.[0]).toBe("/api/admin/videos/video_1/complete-upload");
    expect(intentHeaders.get("Authorization")).toBe("Bearer shopify-id-token");
    expect(uploadHeaders.get("Authorization")).toBe("Bearer shopify-id-token");
    expect(completeHeaders.get("Authorization")).toBe("Bearer shopify-id-token");
  });

  it("throws a safe error when the backend rejects any upload step", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("raw storage failure", {
        status: 500,
      }),
    );

    await expect(uploadManualVideo(createVideoFile(), fetcher)).rejects.toThrow(
      VIDEO_UPLOAD_SAFE_ERROR_MESSAGE,
    );
  });
});

describe("validateVideoFile", () => {
  it("accepts supported video files within the size limit", () => {
    expect(validateVideoFile(createVideoFile("video/webm", 1024))).toBeUndefined();
  });

  it("rejects missing, unsupported, empty, and oversized files", () => {
    expect(validateVideoFile(null)).toBe("Choose a video file before uploading.");
    expect(validateVideoFile(createVideoFile("application/pdf", 1024))).toBe(
      "Choose an MP4, MOV, or WebM video file.",
    );
    expect(validateVideoFile(createVideoFile("video/mp4", 0))).toBe(
      "Choose a video file that is not empty.",
    );
    expect(validateVideoFile(createVideoFile("video/mp4", MAX_VIDEO_SIZE_BYTES + 1))).toBe(
      "Choose a video file that is 500 MB or smaller.",
    );
  });
});
