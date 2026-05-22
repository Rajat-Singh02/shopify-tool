import { describe, expect, it } from "vitest";

import { ShopRepository, type ShopRecord, type ShopRepositoryClient } from "./shop-repository";

function createShop(overrides: Partial<ShopRecord> = {}): ShopRecord {
  const now = new Date("2026-05-22T00:00:00.000Z");

  return {
    id: "shop_1",
    shopDomain: "test-shop.myshopify.com",
    installedAt: now,
    uninstalledAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createClient(existingShop: ShopRecord | null): {
  client: ShopRepositoryClient;
  created: ShopRecord[];
  updated: ShopRecord[];
} {
  const created: ShopRecord[] = [];
  const updated: ShopRecord[] = [];

  return {
    created,
    updated,
    client: {
      shop: {
        findUnique() {
          return Promise.resolve(existingShop);
        },
        create({ data }) {
          const shop = createShop({
            id: "created_shop",
            shopDomain: data.shopDomain,
            installedAt: data.installedAt,
            uninstalledAt: data.uninstalledAt ?? null,
          });
          created.push(shop);
          return Promise.resolve(shop);
        },
        update({ data }) {
          const shop = createShop({
            ...(existingShop ?? {}),
            installedAt: data.installedAt,
            uninstalledAt: data.uninstalledAt ?? null,
          });
          updated.push(shop);
          return Promise.resolve(shop);
        },
      },
    },
  };
}

describe("ShopRepository", () => {
  it("creates a shop when it is missing", async () => {
    const { client, created } = createClient(null);
    const repository = new ShopRepository(client);

    const shop = await repository.ensureInstalled("Test-Shop.myshopify.com");

    expect(shop.shopDomain).toBe("test-shop.myshopify.com");
    expect(created).toHaveLength(1);
  });

  it("returns an existing installed shop", async () => {
    const existingShop = createShop();
    const { client, updated } = createClient(existingShop);
    const repository = new ShopRepository(client);

    const shop = await repository.ensureInstalled(existingShop.shopDomain);

    expect(shop).toBe(existingShop);
    expect(updated).toHaveLength(0);
  });

  it("clears uninstalledAt when a shop reinstalls", async () => {
    const existingShop = createShop({
      uninstalledAt: new Date("2026-05-21T00:00:00.000Z"),
    });
    const { client, updated } = createClient(existingShop);
    const repository = new ShopRepository(client);

    const shop = await repository.ensureInstalled(existingShop.shopDomain);

    expect(shop.uninstalledAt).toBeNull();
    expect(updated).toHaveLength(1);
  });
});
