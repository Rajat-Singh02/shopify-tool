import { describe, expect, it, vi } from "vitest";

import {
  SHOPIFY_PRODUCT_SEARCH_QUERY,
  mapShopifyProductSearchResponse,
  sanitizeProductSearchInput,
  searchShopifyProducts,
  type ShopifyProductGraphqlClient,
} from "./products";

describe("Shopify product search helpers", () => {
  it("sanitizes and limits product search input", () => {
    const input = sanitizeProductSearchInput({
      q: '  Blue "Summer"\\ Shirt \n '.repeat(10),
      first: 999,
      after: " cursor\nvalue ".repeat(80),
    });

    expect(input.first).toBe(50);
    expect(input.query).toHaveLength(120);
    expect(input.query).not.toContain('"');
    expect(input.query).not.toContain("\\");
    expect(input.query).not.toContain("\n");
    expect(input.after).toHaveLength(500);
    expect(input.after).not.toContain("\n");
  });

  it("defaults product search pagination safely", () => {
    expect(sanitizeProductSearchInput({}).first).toBe(20);
    expect(sanitizeProductSearchInput({ first: 0 }).first).toBe(1);
    expect(sanitizeProductSearchInput({ first: 12.8 }).first).toBe(12);
  });

  it("maps Shopify GraphQL products and variants into safe DTOs", () => {
    const response = mapShopifyProductSearchResponse({
      products: {
        edges: [
          {
            cursor: "cursor-1",
            node: {
              id: "gid://shopify/Product/1",
              title: "Linen Shirt",
              handle: "linen-shirt",
              status: "ACTIVE",
              featuredImage: {
                url: "https://cdn.example.test/product.jpg",
                altText: "Front of shirt",
              },
              variants: {
                nodes: [
                  {
                    id: "gid://shopify/ProductVariant/1",
                    title: "Small",
                    sku: "LINEN-S",
                    price: "24.00",
                    inventoryQuantity: 7,
                  },
                ],
              },
            },
          },
        ],
        pageInfo: {
          hasNextPage: true,
          endCursor: "cursor-1",
        },
      },
    });

    expect(response).toEqual({
      products: [
        {
          id: "gid://shopify/Product/1",
          title: "Linen Shirt",
          handle: "linen-shirt",
          status: "ACTIVE",
          featuredImage: {
            url: "https://cdn.example.test/product.jpg",
            altText: "Front of shirt",
          },
          variants: [
            {
              id: "gid://shopify/ProductVariant/1",
              title: "Small",
              sku: "LINEN-S",
              price: "24.00",
              inventoryQuantity: 7,
            },
          ],
        },
      ],
      pageInfo: {
        hasNextPage: true,
        endCursor: "cursor-1",
      },
    });
    expect(JSON.stringify(response)).not.toContain("accessToken");
    expect(JSON.stringify(response)).not.toContain("session");
  });

  it("calls Shopify GraphQL with variables instead of interpolating user input", async () => {
    const request = vi.fn();
    const response = {
      products: {
        edges: [],
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
      },
    };
    const client: ShopifyProductGraphqlClient = {
      request<TData>(query: string, variables: Record<string, unknown>): Promise<TData> {
        request(query, variables);
        return Promise.resolve(response as TData);
      },
    };

    await searchShopifyProducts(client, {
      q: 'title:"unsafe"',
      first: 60,
      after: "after-cursor",
    });

    expect(request).toHaveBeenCalledWith(SHOPIFY_PRODUCT_SEARCH_QUERY, {
      first: 50,
      after: "after-cursor",
      query: "title: unsafe",
    });
  });

  it("does not request inventory fields that can require stricter Shopify permissions", () => {
    expect(SHOPIFY_PRODUCT_SEARCH_QUERY).not.toContain("inventoryQuantity");
  });
});
