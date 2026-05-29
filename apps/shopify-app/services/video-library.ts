import { getShopifyIdToken, type AdminDashboardTokenProvider } from "./admin-shell";

export const ADMIN_VIDEO_LIBRARY_PATH = "/api/admin/videos";
export const VIDEO_LIBRARY_SAFE_ERROR_MESSAGE =
  "We could not load the video library. Reload the app from Shopify admin.";

export type VideoLibraryStatus = "UPLOADED" | "PROCESSING" | "READY" | "FAILED" | "ARCHIVED";
export type VideoLibrarySource = "MANUAL_UPLOAD";

export type VideoLibraryItem = {
  id: string;
  source: VideoLibrarySource;
  status: VideoLibraryStatus;
  originalFilename: string;
  contentType: string;
  sizeBytes: number | string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
};

export type VideoLibraryResult = {
  videos: VideoLibraryItem[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
  summary?: {
    totalCount: number;
    readyCount: number;
  };
};

export type VideoLibraryParams = {
  first?: number;
  after?: string | null;
  status?: VideoLibraryStatus | "";
  source?: VideoLibrarySource | "";
  q?: string;
};

export type VideoLibraryClient = (params: VideoLibraryParams) => Promise<VideoLibraryResult>;
export type VideoDetailClient = (videoId: string) => Promise<VideoLibraryItem>;
export type VideoArchiveClient = (videoId: string) => Promise<VideoLibraryItem>;
export type VideoRetryProcessingClient = (videoId: string) => Promise<VideoLibraryItem>;

export async function fetchAdminVideoLibrary(
  params: VideoLibraryParams,
  fetcher: typeof fetch = fetch,
  tokenProvider: AdminDashboardTokenProvider = getShopifyIdToken,
): Promise<VideoLibraryResult> {
  const response = await fetcher(toVideoLibraryUrl(params), {
    headers: await createVideoLibraryHeaders(tokenProvider),
  });

  if (!response.ok) {
    throw new Error(VIDEO_LIBRARY_SAFE_ERROR_MESSAGE);
  }

  return (await response.json()) as VideoLibraryResult;
}

export async function fetchAdminVideoDetail(
  videoId: string,
  fetcher: typeof fetch = fetch,
  tokenProvider: AdminDashboardTokenProvider = getShopifyIdToken,
): Promise<VideoLibraryItem> {
  const response = await fetcher(`${ADMIN_VIDEO_LIBRARY_PATH}/${encodeURIComponent(videoId)}`, {
    headers: await createVideoLibraryHeaders(tokenProvider),
  });

  if (!response.ok) {
    throw new Error(VIDEO_LIBRARY_SAFE_ERROR_MESSAGE);
  }

  return parseVideoItemResponse(await response.json());
}

export async function archiveAdminVideo(
  videoId: string,
  fetcher: typeof fetch = fetch,
  tokenProvider: AdminDashboardTokenProvider = getShopifyIdToken,
): Promise<VideoLibraryItem> {
  const response = await fetcher(
    `${ADMIN_VIDEO_LIBRARY_PATH}/${encodeURIComponent(videoId)}/archive`,
    {
      method: "POST",
      headers: await createVideoLibraryHeaders(tokenProvider),
    },
  );

  if (!response.ok) {
    throw new Error(VIDEO_LIBRARY_SAFE_ERROR_MESSAGE);
  }

  return parseVideoItemResponse(await response.json());
}

export async function retryAdminVideoProcessing(
  videoId: string,
  fetcher: typeof fetch = fetch,
  tokenProvider: AdminDashboardTokenProvider = getShopifyIdToken,
): Promise<VideoLibraryItem> {
  const response = await fetcher(
    `${ADMIN_VIDEO_LIBRARY_PATH}/${encodeURIComponent(videoId)}/retry-processing`,
    {
      method: "POST",
      headers: await createVideoLibraryHeaders(tokenProvider),
    },
  );

  if (!response.ok) {
    throw new Error(VIDEO_LIBRARY_SAFE_ERROR_MESSAGE);
  }

  return parseVideoItemResponse(await response.json());
}

function parseVideoItemResponse(payload: unknown): VideoLibraryItem {
  if (payload && typeof payload === "object" && "video" in payload) {
    return (payload as { video: VideoLibraryItem }).video;
  }

  return payload as VideoLibraryItem;
}

export function formatVideoDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return "Unknown duration";
  }

  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return `${minutes}:${seconds}`;
}

function toVideoLibraryUrl({ first, after, status, source, q }: VideoLibraryParams): string {
  const searchParams = new URLSearchParams();
  const trimmedQuery = q?.trim();

  if (first !== undefined) {
    searchParams.set("first", String(first));
  }

  if (after) {
    searchParams.set("after", after);
  }

  if (status) {
    searchParams.set("status", status);
  }

  if (source) {
    searchParams.set("source", source);
  }

  if (trimmedQuery) {
    searchParams.set("q", trimmedQuery);
  }

  const queryString = searchParams.toString();

  return queryString ? `${ADMIN_VIDEO_LIBRARY_PATH}?${queryString}` : ADMIN_VIDEO_LIBRARY_PATH;
}

async function createVideoLibraryHeaders(
  tokenProvider: AdminDashboardTokenProvider,
): Promise<Headers> {
  const headers = new Headers({
    Accept: "application/json",
  });
  const token = await safelyLoadVideoLibraryToken(tokenProvider);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

async function safelyLoadVideoLibraryToken(
  tokenProvider: AdminDashboardTokenProvider,
): Promise<string | undefined> {
  try {
    return await tokenProvider();
  } catch {
    return undefined;
  }
}
