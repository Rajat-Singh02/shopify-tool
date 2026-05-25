import type {
  VideoProductTagRecord,
  VideoProductTagRepository,
  VideoRecord,
  VideoRepository,
} from "@shoppable-video/db";

import type { VideoUploadShop } from "./video-upload.js";

const MAX_GID_LENGTH = 160;
const MAX_TITLE_LENGTH = 180;
const MAX_HANDLE_LENGTH = 255;

export type SafeVideoProductTagDto = {
  id: string;
  videoId: string;
  productId: string;
  productTitle: string;
  productHandle: string | null;
  variantId: string;
  variantTitle: string | null;
  createdAt: string;
};

export type VideoProductTagsListResponse = {
  tags: SafeVideoProductTagDto[];
};

export class VideoProductTagExpectedError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly clientMessage = message,
  ) {
    super(message);
    this.name = "VideoProductTagExpectedError";
  }
}

export async function listVideoProductTags({
  shop,
  videoId,
  videoRepository,
  tagRepository,
}: {
  shop: VideoUploadShop;
  videoId: string;
  videoRepository: Pick<VideoRepository, "findByShop">;
  tagRepository: Pick<VideoProductTagRepository, "listActiveByVideo">;
}): Promise<VideoProductTagsListResponse> {
  const video = await requireOwnedVideo(shop.id, videoId, videoRepository);
  const tags = await tagRepository.listActiveByVideo(shop.id, video.id);

  return {
    tags: tags.map(toSafeVideoProductTagDto),
  };
}

export async function createVideoProductTag({
  shop,
  videoId,
  input,
  videoRepository,
  tagRepository,
}: {
  shop: VideoUploadShop;
  videoId: string;
  input: unknown;
  videoRepository: Pick<VideoRepository, "findByShop">;
  tagRepository: Pick<VideoProductTagRepository, "upsertActive">;
}): Promise<SafeVideoProductTagDto> {
  const video = await requireOwnedVideo(shop.id, videoId, videoRepository);

  if (video.status === "ARCHIVED") {
    throw new VideoProductTagExpectedError("Archived videos cannot be tagged", 409);
  }

  const tagInput = parseCreateVideoProductTagInput(input);
  const tag = await tagRepository.upsertActive({
    shopId: shop.id,
    videoId: video.id,
    shopifyProductId: tagInput.productId,
    shopifyVariantId: tagInput.variantId,
    productTitleSnapshot: tagInput.productTitle,
    productHandleSnapshot: tagInput.productHandle,
    variantTitleSnapshot: tagInput.variantTitle,
  });

  return toSafeVideoProductTagDto(tag);
}

export async function deleteVideoProductTag({
  shop,
  videoId,
  tagId,
  videoRepository,
  tagRepository,
}: {
  shop: VideoUploadShop;
  videoId: string;
  tagId: string;
  videoRepository: Pick<VideoRepository, "findByShop">;
  tagRepository: Pick<VideoProductTagRepository, "deactivateByVideo">;
}): Promise<{ deleted: true }> {
  const video = await requireOwnedVideo(shop.id, videoId, videoRepository);
  const tag = await tagRepository.deactivateByVideo(shop.id, video.id, validateTagId(tagId));

  if (!tag) {
    throw new VideoProductTagExpectedError("Product tag was not found", 404);
  }

  return {
    deleted: true,
  };
}

export function toSafeVideoProductTagDto(
  tag: VideoProductTagRecord,
): SafeVideoProductTagDto {
  return {
    id: tag.id,
    videoId: tag.videoId,
    productId: tag.shopifyProductId,
    productTitle: tag.productTitleSnapshot,
    productHandle: tag.productHandleSnapshot,
    variantId: tag.shopifyVariantId,
    variantTitle: tag.variantTitleSnapshot,
    createdAt: tag.createdAt.toISOString(),
  };
}

async function requireOwnedVideo(
  shopId: string,
  videoId: string,
  videoRepository: Pick<VideoRepository, "findByShop">,
): Promise<VideoRecord> {
  const video = await videoRepository.findByShop(shopId, validateVideoId(videoId));

  if (!video) {
    throw new VideoProductTagExpectedError("Video was not found", 404);
  }

  return video;
}

function parseCreateVideoProductTagInput(input: unknown): {
  productId: string;
  productTitle: string;
  productHandle: string | null;
  variantId: string;
  variantTitle: string | null;
} {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new VideoProductTagExpectedError("Request body must be an object", 400);
  }

  const record = input as Record<string, unknown>;

  return {
    productId: validateShopifyGid(record.productId, "Product", "productId is invalid"),
    productTitle: parseRequiredText(record.productTitle, "productTitle is required"),
    productHandle: parseOptionalProductHandle(record.productHandle),
    variantId: validateShopifyGid(record.variantId, "ProductVariant", "variantId is invalid"),
    variantTitle: parseOptionalText(record.variantTitle),
  };
}

function validateShopifyGid(value: unknown, resource: string, message: string): string {
  if (typeof value !== "string") {
    throw new VideoProductTagExpectedError(message, 400);
  }

  const trimmedValue = value.trim();
  const prefix = `gid://shopify/${resource}/`;

  if (
    !trimmedValue.startsWith(prefix) ||
    trimmedValue.length <= prefix.length ||
    trimmedValue.length > MAX_GID_LENGTH ||
    /[\s"'<>]/.test(trimmedValue)
  ) {
    throw new VideoProductTagExpectedError(message, 400);
  }

  return trimmedValue;
}

function parseRequiredText(value: unknown, message: string): string {
  const text = parseOptionalText(value);

  if (!text) {
    throw new VideoProductTagExpectedError(message, 400);
  }

  return text;
}

function parseOptionalText(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new VideoProductTagExpectedError("Display field is invalid", 400);
  }

  const text = value.trim().replace(/\s+/g, " ").slice(0, MAX_TITLE_LENGTH);

  return text || null;
}

function parseOptionalProductHandle(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new VideoProductTagExpectedError("productHandle is invalid", 400);
  }

  const handle = value.trim().toLowerCase();

  if (
    handle.length === 0 ||
    handle.length > MAX_HANDLE_LENGTH ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(handle)
  ) {
    throw new VideoProductTagExpectedError("productHandle is invalid", 400);
  }

  return handle;
}

function validateVideoId(videoId: string): string {
  if (!videoId.trim() || videoId.length > MAX_GID_LENGTH || videoId.includes("/")) {
    throw new VideoProductTagExpectedError("Video was not found", 404);
  }

  return videoId;
}

function validateTagId(tagId: string): string {
  if (!tagId.trim() || tagId.length > MAX_GID_LENGTH || tagId.includes("/")) {
    throw new VideoProductTagExpectedError("Product tag was not found", 404);
  }

  return tagId;
}
