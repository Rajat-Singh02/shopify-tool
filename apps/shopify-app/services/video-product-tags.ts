import {
  getShopifyIdToken,
  type AdminDashboardTokenProvider,
} from "./admin-shell";

export const VIDEO_PRODUCT_TAGS_SAFE_ERROR_MESSAGE =
  "We could not update video product tags. Reload the app from Shopify admin.";

export type VideoProductTag = {
  id: string;
  videoId: string;
  productId: string;
  productTitle: string;
  variantId: string;
  variantTitle: string | null;
  createdAt: string;
};

export type VideoProductTagsResult = {
  tags: VideoProductTag[];
};

export type CreateVideoProductTagInput = {
  productId: string;
  productTitle: string;
  productHandle?: string;
  variantId: string;
  variantTitle?: string | null;
  sku?: string | null;
};

export type VideoProductTagsClient = (videoId: string) => Promise<VideoProductTagsResult>;
export type CreateVideoProductTagClient = (
  videoId: string,
  input: CreateVideoProductTagInput,
) => Promise<VideoProductTag>;
export type DeleteVideoProductTagClient = (
  videoId: string,
  tagId: string,
) => Promise<{ deleted: true }>;

export async function fetchVideoProductTags(
  videoId: string,
  fetcher: typeof fetch = fetch,
  tokenProvider: AdminDashboardTokenProvider = getShopifyIdToken,
): Promise<VideoProductTagsResult> {
  const response = await fetcher(toVideoProductTagsPath(videoId), {
    headers: await createVideoProductTagsHeaders(tokenProvider),
  });

  if (!response.ok) {
    throw new Error(VIDEO_PRODUCT_TAGS_SAFE_ERROR_MESSAGE);
  }

  return (await response.json()) as VideoProductTagsResult;
}

export async function createVideoProductTag(
  videoId: string,
  input: CreateVideoProductTagInput,
  fetcher: typeof fetch = fetch,
  tokenProvider: AdminDashboardTokenProvider = getShopifyIdToken,
): Promise<VideoProductTag> {
  const response = await fetcher(toVideoProductTagsPath(videoId), {
    method: "POST",
    headers: await createVideoProductTagsHeaders(tokenProvider, true),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(VIDEO_PRODUCT_TAGS_SAFE_ERROR_MESSAGE);
  }

  const body = (await response.json()) as {
    tag: VideoProductTag;
  };

  return body.tag;
}

export async function deleteVideoProductTag(
  videoId: string,
  tagId: string,
  fetcher: typeof fetch = fetch,
  tokenProvider: AdminDashboardTokenProvider = getShopifyIdToken,
): Promise<{ deleted: true }> {
  const response = await fetcher(
    `${toVideoProductTagsPath(videoId)}/${encodeURIComponent(tagId)}`,
    {
      method: "DELETE",
      headers: await createVideoProductTagsHeaders(tokenProvider),
    },
  );

  if (!response.ok) {
    throw new Error(VIDEO_PRODUCT_TAGS_SAFE_ERROR_MESSAGE);
  }

  return (await response.json()) as { deleted: true };
}

function toVideoProductTagsPath(videoId: string): string {
  return `/api/admin/videos/${encodeURIComponent(videoId)}/product-tags`;
}

async function createVideoProductTagsHeaders(
  tokenProvider: AdminDashboardTokenProvider,
  includeJson = false,
): Promise<Headers> {
  const headers = new Headers({
    Accept: "application/json",
  });
  const token = await safelyLoadVideoProductTagsToken(tokenProvider);

  if (includeJson) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

async function safelyLoadVideoProductTagsToken(
  tokenProvider: AdminDashboardTokenProvider,
): Promise<string | undefined> {
  try {
    return await tokenProvider();
  } catch {
    return undefined;
  }
}
