import { describe, expect, it } from "vitest";

import { handleAdminDashboardContextRequest, loadAdminDashboard } from "../routes/app.server";
import { ADMIN_SHELL_SAFE_ERROR_MESSAGE } from "../services/admin-shell";

describe("admin dashboard loader", () => {
  const shop = {
    id: "shop_1",
    shopDomain: "test-shop.myshopify.com",
    installedAt: new Date("2026-05-22T00:00:00.000Z"),
    uninstalledAt: null,
    createdAt: new Date("2026-05-22T00:00:00.000Z"),
    updatedAt: new Date("2026-05-22T00:00:00.000Z"),
  };

  it("uses the auth helper boundary and returns dashboard context", async () => {
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
      shop: {
        domain: shop.shopDomain,
        installedAt: "2026-05-22T00:00:00.000Z",
      },
      overview: {
        activeScopeLabel: "Manual upload only",
      },
    });
  });

  it("does not return session or secret data", async () => {
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

    const serializedResult = JSON.stringify(result);

    expect(serializedResult).not.toContain("accessToken");
    expect(serializedResult).not.toContain("apiSecret");
    expect(serializedResult).not.toContain("session");
  });

  it("serializes authenticated dashboard data with no-store caching", async () => {
    const response = await handleAdminDashboardContextRequest(
      new Request("https://app.example.test/api/admin/dashboard"),
      {
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
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      shop: {
        domain: shop.shopDomain,
        installedAt: "2026-05-22T00:00:00.000Z",
      },
      overview: {
        activeScopeLabel: "Manual upload only",
      },
    });
  });

  it("returns a safe error when authentication fails", async () => {
    const response = await handleAdminDashboardContextRequest(
      new Request("https://app.example.test/api/admin/dashboard"),
      {
        authenticateAdmin() {
          throw new Error("raw auth failure with token");
        },
        shopRepository: {
          ensureInstalled() {
            throw new Error("shop repository should not be called");
          },
        },
      },
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      message: ADMIN_SHELL_SAFE_ERROR_MESSAGE,
    });
  });
});
