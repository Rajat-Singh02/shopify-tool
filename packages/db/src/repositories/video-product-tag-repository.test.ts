import { describe, expect, it } from "vitest";

import {
  VideoProductTagRepository,
  type VideoProductTagRecord,
  type VideoProductTagRepositoryClient,
} from "./video-product-tag-repository";

function createTag(overrides: Partial<VideoProductTagRecord> = {}): VideoProductTagRecord {
  const now = new Date("2026-05-23T00:00:00.000Z");

  return {
    id: "tag_1",
    shopId: "shop_1",
    videoId: "video_1",
    shopifyProductId: "gid://shopify/Product/1",
    shopifyVariantId: "gid://shopify/ProductVariant/1",
    productTitleSnapshot: "Linen Shirt",
    productHandleSnapshot: "linen-shirt",
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

function createClient(existingTag: VideoProductTagRecord | null = null): {
  client: VideoProductTagRepositoryClient;
  created: VideoProductTagRecord[];
  updated: VideoProductTagRecord[];
  findManyArgs: unknown[];
} {
  const created: VideoProductTagRecord[] = [];
  const updated: VideoProductTagRecord[] = [];
  const findManyArgs: unknown[] = [];

  return {
    created,
    updated,
    findManyArgs,
    client: {
      videoProductTag: {
        findMany(args) {
          findManyArgs.push(args);

          return Promise.resolve(existingTag ? [existingTag] : []);
        },
        findFirst({ where }) {
          if (
            existingTag &&
            (!where.id || existingTag.id === where.id) &&
            (!where.shopId || existingTag.shopId === where.shopId) &&
            (!where.videoId || existingTag.videoId === where.videoId) &&
            (!where.shopifyProductId || existingTag.shopifyProductId === where.shopifyProductId) &&
            (!where.shopifyVariantId || existingTag.shopifyVariantId === where.shopifyVariantId) &&
            (where.isActive === undefined || existingTag.isActive === where.isActive)
          ) {
            return Promise.resolve(existingTag);
          }

          return Promise.resolve(null);
        },
        create({ data }) {
          const tag = createTag(data);

          created.push(tag);

          return Promise.resolve(tag);
        },
        update({ data }) {
          const tag = createTag({
            ...(existingTag ?? {}),
            ...data,
          });

          updated.push(tag);

          return Promise.resolve(tag);
        },
      },
    },
  };
}

describe("VideoProductTagRepository", () => {
  it("lists active tags for a shop video", async () => {
    const tag = createTag();
    const { client, findManyArgs } = createClient(tag);
    const repository = new VideoProductTagRepository(client);

    await expect(repository.listActiveByVideo("shop_1", "video_1")).resolves.toEqual([tag]);
    expect(findManyArgs[0]).toMatchObject({
      where: {
        shopId: "shop_1",
        videoId: "video_1",
        isActive: true,
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  });

  it("creates a tag with required safe fields", async () => {
    const { client, created } = createClient();
    const repository = new VideoProductTagRepository(client);

    const tag = await repository.upsertActive({
      shopId: "shop_1",
      videoId: "video_1",
      shopifyProductId: "gid://shopify/Product/1",
      shopifyVariantId: "gid://shopify/ProductVariant/1",
      productTitleSnapshot: "Linen Shirt",
      productHandleSnapshot: "linen-shirt",
      variantTitleSnapshot: "Small",
    });

    expect(tag).toMatchObject({
      shopId: "shop_1",
      videoId: "video_1",
      shopifyProductId: "gid://shopify/Product/1",
      shopifyVariantId: "gid://shopify/ProductVariant/1",
      productTitleSnapshot: "Linen Shirt",
      productHandleSnapshot: "linen-shirt",
      variantTitleSnapshot: "Small",
      isActive: true,
    });
    expect(created).toHaveLength(1);
  });

  it("reactivates an existing tag idempotently", async () => {
    const existingTag = createTag({
      isActive: false,
      productTitleSnapshot: "Old title",
    });
    const { client, created, updated } = createClient(existingTag);
    const repository = new VideoProductTagRepository(client);

    const tag = await repository.upsertActive({
      shopId: "shop_1",
      videoId: "video_1",
      shopifyProductId: "gid://shopify/Product/1",
      shopifyVariantId: "gid://shopify/ProductVariant/1",
      productTitleSnapshot: "Updated title",
      productHandleSnapshot: "updated-title",
      variantTitleSnapshot: "Medium",
    });

    expect(tag).toMatchObject({
      id: "tag_1",
      productTitleSnapshot: "Updated title",
      productHandleSnapshot: "updated-title",
      variantTitleSnapshot: "Medium",
      isActive: true,
    });
    expect(created).toHaveLength(0);
    expect(updated).toHaveLength(1);
  });

  it("deactivates tags only when they belong to the shop video", async () => {
    const { client, updated } = createClient(createTag());
    const repository = new VideoProductTagRepository(client);

    await expect(repository.deactivateByVideo("shop_1", "video_1", "tag_1")).resolves.toMatchObject({
      isActive: false,
    });
    await expect(repository.deactivateByVideo("shop_2", "video_1", "tag_1")).resolves.toBeNull();
    expect(updated).toHaveLength(1);
  });
});
