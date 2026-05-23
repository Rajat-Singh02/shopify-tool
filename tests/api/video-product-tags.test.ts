import { describe, expect, it, vi } from "vitest";

import type { VideoProductTagRecord, VideoRecord } from "@shoppable-video/db";

import {
  createVideoProductTag,
  deleteVideoProductTag,
  listVideoProductTags,
  toSafeVideoProductTagDto,
  VideoProductTagExpectedError,
} from "../../api/video-product-tags";

const shop = {
  id: "shop_1",
  shopDomain: "test-shop.myshopify.com",
};

function createVideo(overrides: Partial<VideoRecord> = {}): VideoRecord {
  const now = new Date("2026-05-23T00:00:00.000Z");

  return {
    id: "video_1",
    shopId: "shop_1",
    source: "MANUAL_UPLOAD",
    originalFilename: "demo.mp4",
    originalMimeType: "video/mp4",
    originalSizeBytes: 12n,
    status: "READY",
    storageKeyOriginal: "shops/shop_1/videos/video_1/original/demo.mp4",
    storageKeyOptimized: null,
    playbackUrl: null,
    thumbnailUrl: null,
    durationMs: null,
    width: null,
    height: null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createTag(overrides: Partial<VideoProductTagRecord> = {}): VideoProductTagRecord {
  const now = new Date("2026-05-23T00:00:00.000Z");

  return {
    id: "tag_1",
    shopId: "shop_1",
    videoId: "video_1",
    shopifyProductId: "gid://shopify/Product/1",
    shopifyVariantId: "gid://shopify/ProductVariant/1",
    productTitleSnapshot: "Linen Shirt",
    variantTitleSnapshot: "Small",
    productImageUrlSnapshot: null,
    priceSnapshot: null,
    currencyCodeSnapshot: null,
    position: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("video product tag services", () => {
  it("lists tags only after verifying current-shop video ownership", async () => {
    const tag = createTag();
    const findByShop = vi.fn().mockResolvedValue(createVideo());
    const listActiveByVideo = vi.fn().mockResolvedValue([tag]);

    const result = await listVideoProductTags({
      shop,
      videoId: "video_1",
      videoRepository: {
        findByShop,
      },
      tagRepository: {
        listActiveByVideo,
      },
    });
    const serialized = JSON.stringify(result);

    expect(findByShop).toHaveBeenCalledWith("shop_1", "video_1");
    expect(listActiveByVideo).toHaveBeenCalledWith("shop_1", "video_1");
    expect(result.tags).toEqual([toSafeVideoProductTagDto(tag)]);
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain("storageKeyOriginal");
  });

  it("creates an idempotent safe product tag for a current-shop video", async () => {
    const tag = createTag({
      productTitleSnapshot: "Linen Shirt",
      variantTitleSnapshot: "Small",
    });
    const upsertActive = vi.fn().mockResolvedValue(tag);

    const result = await createVideoProductTag({
      shop,
      videoId: "video_1",
      input: {
        productId: "gid://shopify/Product/1",
        productTitle: "  Linen    Shirt  ",
        variantId: "gid://shopify/ProductVariant/1",
        variantTitle: "  Small  ",
        sku: "IGNORED-SKU",
      },
      videoRepository: {
        findByShop: vi.fn().mockResolvedValue(createVideo()),
      },
      tagRepository: {
        upsertActive,
      },
    });

    expect(upsertActive).toHaveBeenCalledWith({
      shopId: "shop_1",
      videoId: "video_1",
      shopifyProductId: "gid://shopify/Product/1",
      shopifyVariantId: "gid://shopify/ProductVariant/1",
      productTitleSnapshot: "Linen Shirt",
      variantTitleSnapshot: "Small",
    });
    expect(result).toEqual(toSafeVideoProductTagDto(tag));
  });

  it("rejects invalid product and variant GIDs safely", async () => {
    const baseInput = {
      productId: "gid://shopify/Product/1",
      productTitle: "Linen Shirt",
      variantId: "gid://shopify/ProductVariant/1",
    };
    const dependencies = {
      shop,
      videoId: "video_1",
      videoRepository: {
        findByShop: vi.fn().mockResolvedValue(createVideo()),
      },
      tagRepository: {
        upsertActive: vi.fn(),
      },
    };

    await expect(
      createVideoProductTag({
        ...dependencies,
        input: {
          ...baseInput,
          productId: "gid://shopify/ProductVariant/1",
        },
      }),
    ).rejects.toThrow(VideoProductTagExpectedError);
    await expect(
      createVideoProductTag({
        ...dependencies,
        input: {
          ...baseInput,
          variantId: "not-a-gid",
        },
      }),
    ).rejects.toThrow(VideoProductTagExpectedError);
  });

  it("blocks archived videos from new product tags", async () => {
    await expect(
      createVideoProductTag({
        shop,
        videoId: "video_1",
        input: {
          productId: "gid://shopify/Product/1",
          productTitle: "Linen Shirt",
          variantId: "gid://shopify/ProductVariant/1",
        },
        videoRepository: {
          findByShop: vi.fn().mockResolvedValue(createVideo({ status: "ARCHIVED" })),
        },
        tagRepository: {
          upsertActive: vi.fn(),
        },
      }),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it("deletes tags only after verifying video and tag ownership", async () => {
    const deactivateByVideo = vi.fn().mockResolvedValue(createTag({ isActive: false }));

    await expect(
      deleteVideoProductTag({
        shop,
        videoId: "video_1",
        tagId: "tag_1",
        videoRepository: {
          findByShop: vi.fn().mockResolvedValue(createVideo()),
        },
        tagRepository: {
          deactivateByVideo,
        },
      }),
    ).resolves.toEqual({
      deleted: true,
    });
    expect(deactivateByVideo).toHaveBeenCalledWith("shop_1", "video_1", "tag_1");
  });

  it("returns safe 404 errors for missing wrong-shop videos or tags", async () => {
    await expect(
      listVideoProductTags({
        shop,
        videoId: "video_1",
        videoRepository: {
          findByShop: vi.fn().mockResolvedValue(null),
        },
        tagRepository: {
          listActiveByVideo: vi.fn(),
        },
      }),
    ).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      deleteVideoProductTag({
        shop,
        videoId: "video_1",
        tagId: "tag_1",
        videoRepository: {
          findByShop: vi.fn().mockResolvedValue(createVideo()),
        },
        tagRepository: {
          deactivateByVideo: vi.fn().mockResolvedValue(null),
        },
      }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });
});
