import { describe, expect, it } from "vitest";

import { ensureShopForSession } from "../services/shop-lifecycle.server";

describe("ensureShopForSession", () => {
  it("ensures a Shop record exists for the authenticated session shop", async () => {
    const shop = {
      id: "shop_1",
      shopDomain: "test-shop.myshopify.com",
      installedAt: new Date("2026-05-22T00:00:00.000Z"),
      uninstalledAt: null,
      createdAt: new Date("2026-05-22T00:00:00.000Z"),
      updatedAt: new Date("2026-05-22T00:00:00.000Z"),
    };

    const result = await ensureShopForSession(
      { shop: shop.shopDomain },
      {
        shopRepository: {
          ensureInstalled(shopDomain) {
            expect(shopDomain).toBe(shop.shopDomain);
            return Promise.resolve(shop);
          },
        },
      },
    );

    expect(result).toBe(shop);
  });
});
