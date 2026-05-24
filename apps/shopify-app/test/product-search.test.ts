import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_PRODUCT_SEARCH_PATH,
  fetchAdminProductSearch,
  PRODUCT_SEARCH_RECONNECT_MESSAGE,
  PRODUCT_SEARCH_SAFE_ERROR_MESSAGE,
} from "../services/product-search";

describe("fetchAdminProductSearch", () => {
  it("loads products from the authenticated admin endpoint", async () => {
    const result = {
      products: [],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    await expect(fetchAdminProductSearch({ q: "linen shirt", first: 20 }, fetcher)).resolves.toEqual(
      result,
    );
    const requestInit = fetcher.mock.calls[0]?.[1];
    const headers = new Headers(requestInit?.headers);

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      `${ADMIN_PRODUCT_SEARCH_PATH}?q=linen+shirt&first=20`,
    );
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Authorization")).toBeNull();
  });

  it("attaches an App Bridge ID token when one is available", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          products: [],
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    await fetchAdminProductSearch(
      { q: "shirt", first: 20, after: "cursor-1" },
      fetcher,
      () => Promise.resolve("shopify-id-token"),
    );
    const requestInit = fetcher.mock.calls[0]?.[1];
    const headers = new Headers(requestInit?.headers);

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      `${ADMIN_PRODUCT_SEARCH_PATH}?q=shirt&first=20&after=cursor-1`,
    );
    expect(headers.get("Authorization")).toBe("Bearer shopify-id-token");
  });

  it("throws a safe error when product search is rejected", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("raw token failure", {
        status: 410,
      }),
    );

    await expect(fetchAdminProductSearch({}, fetcher)).rejects.toThrow(
      PRODUCT_SEARCH_SAFE_ERROR_MESSAGE,
    );
  });

  it("uses a safe server message when product search needs reconnection", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          message: PRODUCT_SEARCH_RECONNECT_MESSAGE,
        },
        {
          status: 410,
        },
      ),
    );

    await expect(fetchAdminProductSearch({}, fetcher)).rejects.toThrow(
      PRODUCT_SEARCH_RECONNECT_MESSAGE,
    );
  });
});
