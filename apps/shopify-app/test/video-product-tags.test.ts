import { describe, expect, it, vi } from "vitest";

import {
  createVideoProductTag,
  deleteVideoProductTag,
  fetchVideoProductTags,
  VIDEO_PRODUCT_TAGS_SAFE_ERROR_MESSAGE,
} from "../services/video-product-tags";

const tag = {
  id: "tag_1",
  videoId: "video_1",
  productId: "gid://shopify/Product/1",
  productTitle: "Linen Shirt",
  productHandle: "linen-shirt",
  variantId: "gid://shopify/ProductVariant/1",
  variantTitle: "Small",
  createdAt: "2026-05-23T00:00:00.000Z",
};

describe("video product tag client", () => {
  it("loads video product tags with an App Bridge bearer token", async () => {
    let capturedHeaders = new Headers();
    const fetcher = vi.fn<typeof fetch>((_input, init) => {
      capturedHeaders = toHeaders(init?.headers);

      return Promise.resolve(Response.json({
        tags: [tag],
      }));
    });

    const result = await fetchVideoProductTags(
      "video_1",
      fetcher,
      () => Promise.resolve("shopify-id-token"),
    );

    expect(result.tags).toEqual([tag]);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/admin/videos/video_1/product-tags",
      expect.objectContaining({}),
    );
    expect(capturedHeaders.get("Authorization")).toBe("Bearer shopify-id-token");
    expect(capturedHeaders.get("Accept")).toBe("application/json");
  });

  it("creates a variant-level product tag with safe JSON headers", async () => {
    let capturedHeaders = new Headers();
    const fetcher = vi.fn<typeof fetch>((_input, init) => {
      capturedHeaders = toHeaders(init?.headers);

      return Promise.resolve(Response.json({
        tag,
      }));
    });
    const input = {
      productId: "gid://shopify/Product/1",
      productTitle: "Linen Shirt",
      productHandle: "linen-shirt",
      variantId: "gid://shopify/ProductVariant/1",
      variantTitle: "Small",
      sku: "LINEN-S",
    };

    const result = await createVideoProductTag(
      "video_1",
      input,
      fetcher,
      () => Promise.resolve("shopify-id-token"),
    );

    expect(result).toEqual(tag);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/admin/videos/video_1/product-tags",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
    expect(capturedHeaders.get("Authorization")).toBe("Bearer shopify-id-token");
    expect(capturedHeaders.get("Content-Type")).toBe("application/json");
  });

  it("removes one product tag through the current video route", async () => {
    let capturedHeaders = new Headers();
    const fetcher = vi.fn<typeof fetch>((_input, init) => {
      capturedHeaders = toHeaders(init?.headers);

      return Promise.resolve(Response.json({
        deleted: true,
      }));
    });

    await expect(
      deleteVideoProductTag("video_1", "tag_1", fetcher, () =>
        Promise.resolve("shopify-id-token"),
      ),
    ).resolves.toEqual({ deleted: true });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/admin/videos/video_1/product-tags/tag_1",
      expect.objectContaining({
        method: "DELETE",
      }),
    );
    expect(capturedHeaders.get("Authorization")).toBe("Bearer shopify-id-token");
  });

  it("returns safe client errors without exposing backend details", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          message: "raw backend token failure",
        },
        { status: 401 },
      ),
    );

    await expect(
      fetchVideoProductTags("video_1", fetcher, () => Promise.resolve("shopify-id-token")),
    ).rejects.toThrow(VIDEO_PRODUCT_TAGS_SAFE_ERROR_MESSAGE);
  });
});

function toHeaders(headers: HeadersInit | undefined): Headers {
  return headers instanceof Headers ? headers : new Headers(headers);
}
