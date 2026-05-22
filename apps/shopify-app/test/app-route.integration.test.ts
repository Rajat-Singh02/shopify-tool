import { describe, expect, it } from "vitest";

import { loadAdminDashboard } from "../routes/app.server";

describe("admin dashboard loader", () => {
  it("uses the auth helper boundary and returns dashboard context", async () => {
    const shop = {
      id: "shop_1",
      shopDomain: "test-shop.myshopify.com",
      installedAt: new Date("2026-05-22T00:00:00.000Z"),
      uninstalledAt: null,
      createdAt: new Date("2026-05-22T00:00:00.000Z"),
      updatedAt: new Date("2026-05-22T00:00:00.000Z"),
    };

    const result = await loadAdminDashboard(new Request("https://app.example.test"), {
      authenticateAdmin() {
        return Promise.resolve({
          session: {
            shop: shop.shopDomain,
          },
        });
      },
      shopRepository: {
        ensureInstalled() {
          return Promise.resolve(shop);
        },
      },
    });

    expect(result).toEqual({
      shopDomain: shop.shopDomain,
      overview: {
        activeScopeLabel: "Manual upload only",
      },
    });
  });
});
