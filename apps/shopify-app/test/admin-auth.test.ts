import { describe, expect, it } from "vitest";

import { authenticateAdminRequest } from "../services/admin-auth.server";

describe("authenticateAdminRequest", () => {
  it("returns shop context from a mocked Shopify authenticator", async () => {
    const shop = {
      id: "shop_1",
      shopDomain: "test-shop.myshopify.com",
      installedAt: new Date("2026-05-22T00:00:00.000Z"),
      uninstalledAt: null,
      createdAt: new Date("2026-05-22T00:00:00.000Z"),
      updatedAt: new Date("2026-05-22T00:00:00.000Z"),
    };

    const context = await authenticateAdminRequest(new Request("https://app.example.test"), {
      authenticateAdmin() {
        return Promise.resolve({
          session: {
            shop: shop.shopDomain,
          },
        });
      },
      shopRepository: {
        ensureInstalled(shopDomain) {
          expect(shopDomain).toBe(shop.shopDomain);
          return Promise.resolve(shop);
        },
      },
    });

    expect(context.shopDomain).toBe(shop.shopDomain);
  });

  it("keeps unauthenticated behavior explicit", async () => {
    await expect(
      authenticateAdminRequest(new Request("https://app.example.test"), {
        authenticateAdmin() {
          return Promise.reject(new Error("Unauthorized"));
        },
        shopRepository: {
          ensureInstalled() {
            return Promise.reject(new Error("should not be called"));
          },
        },
      }),
    ).rejects.toThrow("Unauthorized");
  });
});
