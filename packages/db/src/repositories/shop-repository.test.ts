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
  upsertCreatedData: Array<{
    id: string;
    shopDomain: string;
    installedAt: Date;
    uninstalledAt: null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  updated: ShopRecord[];
} {
  const created: ShopRecord[] = [];
  const upsertCreatedData: Array<{
    id: string;
    shopDomain: string;
    installedAt: Date;
    uninstalledAt: null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  const updated: ShopRecord[] = [];

  return {
    created,
    upsertCreatedData,
    updated,
    client: {
      shop: {
        findUnique() {
          return Promise.resolve(existingShop);
        },
        upsert({ create, update }) {
          if (existingShop) {
            const shop = createShop({
              ...existingShop,
              uninstalledAt: update.uninstalledAt,
              updatedAt: update.updatedAt,
            });
            updated.push(shop);
            return Promise.resolve(shop);
          }

          const shop = createShop({
            id: create.id,
            shopDomain: create.shopDomain,
            installedAt: create.installedAt,
            uninstalledAt: create.uninstalledAt,
            createdAt: create.createdAt,
            updatedAt: create.updatedAt,
          });
          upsertCreatedData.push(create);
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
    const { client, created, upsertCreatedData } = createClient(null);
    const repository = new ShopRepository(client);

    const shop = await repository.ensureInstalled("Test-Shop.myshopify.com");

    expect(shop.shopDomain).toBe("test-shop.myshopify.com");
    expect(created).toHaveLength(1);
    expect(upsertCreatedData[0]).toMatchObject({
      shopDomain: "test-shop.myshopify.com",
      installedAt: expect.any(Date) as Date,
      uninstalledAt: null,
      createdAt: expect.any(Date) as Date,
      updatedAt: expect.any(Date) as Date,
    });
    expect(upsertCreatedData[0]?.id).toEqual(expect.any(String));
    expect(upsertCreatedData[0]?.id).not.toHaveLength(0);
  });

  it("returns an existing installed shop", async () => {
    const existingShop = createShop();
    const { client, updated } = createClient(existingShop);
    const repository = new ShopRepository(client);

    const shop = await repository.ensureInstalled(existingShop.shopDomain);

    expect(shop.shopDomain).toBe(existingShop.shopDomain);
    expect(updated).toHaveLength(1);
    expect(updated[0]?.uninstalledAt).toBeNull();
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

  it("marks an installed shop uninstalled", async () => {
    const existingShop = createShop();
    const { client, updated } = createClient(existingShop);
    const repository = new ShopRepository(client);
    const uninstalledAt = new Date("2026-05-22T12:00:00.000Z");

    const shop = await repository.markUninstalled(existingShop.shopDomain, uninstalledAt);

    expect(shop?.uninstalledAt).toEqual(uninstalledAt);
    expect(updated).toHaveLength(1);
  });

  it("does not repeat uninstall side effects for already uninstalled shops", async () => {
    const existingShop = createShop({
      uninstalledAt: new Date("2026-05-21T00:00:00.000Z"),
    });
    const { client, updated } = createClient(existingShop);
    const repository = new ShopRepository(client);

    const shop = await repository.markUninstalled(existingShop.shopDomain);

    expect(shop).toBe(existingShop);
    expect(updated).toHaveLength(0);
  });

  it("returns null when uninstalling a missing shop", async () => {
    const { client, updated } = createClient(null);
    const repository = new ShopRepository(client);

    const shop = await repository.markUninstalled("missing-shop.myshopify.com");

    expect(shop).toBeNull();
    expect(updated).toHaveLength(0);
  });
});
