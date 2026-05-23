import {
  getShopifyIdToken,
  type AdminDashboardTokenProvider,
} from "./admin-shell";

export const VIDEO_UPLOAD_INTENT_PATH = "/api/admin/videos/upload-intent";
export const VIDEO_UPLOAD_SAFE_ERROR_MESSAGE =
  "We could not upload this video. Reload the app from Shopify admin and try again.";
export const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024;

export type UploadedVideo = {
  id: string;
  status: string;
  source: "MANUAL_UPLOAD";
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
};

export type VideoUploadIntentResponse = {
  video: UploadedVideo;
  upload: {
    method: "PUT" | "POST";
    url: string;
    headers: Record<string, string>;
    expiresAt: string;
  };
};

export type VideoUploadResult = {
  video: UploadedVideo;
};

export type VideoUploadClient = (file: File) => Promise<VideoUploadResult>;

export async function uploadManualVideo(
  file: File,
  fetcher: typeof fetch = fetch,
  tokenProvider: AdminDashboardTokenProvider = getShopifyIdToken,
): Promise<VideoUploadResult> {
  const token = await safelyLoadVideoUploadToken(tokenProvider);
  const intent = await createVideoUploadIntent(file, fetcher, token);

  await uploadVideoFile(file, intent, fetcher, token);

  return completeVideoUpload(intent.video.id, fetcher, token);
}

export function validateVideoFile(file: File | null): string | undefined {
  if (!file) {
    return "Choose a video file before uploading.";
  }

  if (!isAllowedVideoMimeType(file.type)) {
    return "Choose an MP4, MOV, or WebM video file.";
  }

  if (file.size <= 0) {
    return "Choose a video file that is not empty.";
  }

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return "Choose a video file that is 500 MB or smaller.";
  }

  return undefined;
}

export function formatVideoFileSize(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${sizeBytes} B`;
}

function isAllowedVideoMimeType(contentType: string): boolean {
  return ALLOWED_VIDEO_MIME_TYPES.includes(
    contentType as (typeof ALLOWED_VIDEO_MIME_TYPES)[number],
  );
}

async function createVideoUploadIntent(
  file: File,
  fetcher: typeof fetch,
  token: string | undefined,
): Promise<VideoUploadIntentResponse> {
  const response = await fetcher(VIDEO_UPLOAD_INTENT_PATH, {
    method: "POST",
    headers: createJsonHeaders(token),
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    }),
  });

  if (!response.ok) {
    throw new Error(VIDEO_UPLOAD_SAFE_ERROR_MESSAGE);
  }

  return (await response.json()) as VideoUploadIntentResponse;
}

async function uploadVideoFile(
  file: File,
  intent: VideoUploadIntentResponse,
  fetcher: typeof fetch,
  token: string | undefined,
): Promise<void> {
  const headers = new Headers(intent.upload.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetcher(intent.upload.url, {
    method: intent.upload.method,
    headers,
    body: file,
  });

  if (!response.ok) {
    throw new Error(VIDEO_UPLOAD_SAFE_ERROR_MESSAGE);
  }
}

async function completeVideoUpload(
  videoId: string,
  fetcher: typeof fetch,
  token: string | undefined,
): Promise<VideoUploadResult> {
  const response = await fetcher(`/api/admin/videos/${encodeURIComponent(videoId)}/complete-upload`, {
    method: "POST",
    headers: createJsonHeaders(token),
  });

  if (!response.ok) {
    throw new Error(VIDEO_UPLOAD_SAFE_ERROR_MESSAGE);
  }

  return (await response.json()) as VideoUploadResult;
}

function createJsonHeaders(token: string | undefined): Headers {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

async function safelyLoadVideoUploadToken(
  tokenProvider: AdminDashboardTokenProvider,
): Promise<string | undefined> {
  try {
    return await tokenProvider();
  } catch {
    return undefined;
  }
}
