import { Session } from "@shopify/shopify-api";
import { describe, expect, it } from "vitest";

import {
  PrismaShopifySessionStorage,
  type ShopifySessionRecord,
  type ShopifySessionStorageClient,
} from "./shopify-session-storage";

function createSession(overrides: Partial<ConstructorParameters<typeof Session>[0]> = {}) {
  return new Session({
    id: "offline_test-shop.myshopify.com",
    shop: "test-shop.myshopify.com",
    state: "state",
    isOnline: false,
    scope: "read_products",
    accessToken: "shpat_secret",
    ...overrides,
  });
}

function createClient(): {
  client: ShopifySessionStorageClient;
  records: Map<string, ShopifySessionRecord>;
} {
  const records = new Map<string, ShopifySessionRecord>();

  return {
    records,
    client: {
      shopifySession: {
        upsert({ where, create, update }) {
          const existing = records.get(where.id);
          const record: ShopifySessionRecord = {
            id: where.id,
            shop: existing ? update.shop : create.shop,
            state: existing ? update.state : create.state,
            isOnline: existing ? update.isOnline : create.isOnline,
            scope: (existing ? update.scope : create.scope) ?? null,
            expires: (existing ? update.expires : create.expires) ?? null,
            payload: existing ? update.payload : create.payload,
          };
          records.set(where.id, record);
          return Promise.resolve(record);
        },
        findUnique({ where }) {
          return Promise.resolve(records.get(where.id) ?? null);
        },
        findMany({ where }) {
          return Promise.resolve([...records.values()].filter((record) => record.shop === where.shop));
        },
        delete({ where }) {
          const record = records.get(where.id);
          if (!record) {
            throw new Error("Record not found");
          }
          records.delete(where.id);
          return Promise.resolve(record);
        },
        deleteMany({ where }) {
          let count = 0;
          for (const id of where.id.in) {
            if (records.delete(id)) {
              count += 1;
            }
          }
          return Promise.resolve({ count });
        },
      },
    },
  };
}

describe("PrismaShopifySessionStorage", () => {
  it("stores and loads a Shopify session", async () => {
    const { client } = createClient();
    const storage = new PrismaShopifySessionStorage(client);
    const session = createSession();

    await expect(storage.storeSession(session)).resolves.toBe(true);

    const loadedSession = await storage.loadSession(session.id);
    expect(loadedSession?.equals(session)).toBe(true);
  });

  it("finds sessions by shop", async () => {
    const { client } = createClient();
    const storage = new PrismaShopifySessionStorage(client);
    const session = createSession();

    await storage.storeSession(session);

    await expect(storage.findSessionsByShop(session.shop)).resolves.toHaveLength(1);
  });

  it("deletes a stored session", async () => {
    const { client } = createClient();
    const storage = new PrismaShopifySessionStorage(client);
    const session = createSession();

    await storage.storeSession(session);

    await expect(storage.deleteSession(session.id)).resolves.toBe(true);
    await expect(storage.loadSession(session.id)).resolves.toBeUndefined();
  });

  it("identifies the production storage type as prisma", () => {
    const { client } = createClient();
    const storage = new PrismaShopifySessionStorage(client);

    expect(storage.storageType).toBe("prisma");
  });
});
