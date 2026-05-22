import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";

type SerializedSessionProperty = [string, string | number | boolean];

export type ShopifySessionRecord = {
  id: string;
  shop: string;
  state: string;
  isOnline: boolean;
  scope: string | null;
  expires: Date | null;
  payload: string;
};

export type ShopifySessionStorageClient = {
  shopifySession: {
    upsert(args: {
      where: { id: string };
      create: {
        id: string;
        shop: string;
        state: string;
        isOnline: boolean;
        scope?: string;
        expires?: Date;
        payload: string;
      };
      update: {
        shop: string;
        state: string;
        isOnline: boolean;
        scope?: string | null;
        expires?: Date | null;
        payload: string;
      };
    }): Promise<ShopifySessionRecord>;
    findUnique(args: { where: { id: string } }): Promise<ShopifySessionRecord | null>;
    findMany(args: { where: { shop: string } }): Promise<ShopifySessionRecord[]>;
    delete(args: { where: { id: string } }): Promise<ShopifySessionRecord>;
    deleteMany(args: { where: { id: { in: string[] } } }): Promise<{ count: number }>;
  };
};

export class PrismaShopifySessionStorage implements SessionStorage {
  readonly storageType = "prisma" as const;

  constructor(private readonly client: ShopifySessionStorageClient) {}

  async storeSession(session: Session): Promise<boolean> {
    const payload = serializeSession(session);

    await this.client.shopifySession.upsert({
      where: { id: session.id },
      create: {
        id: session.id,
        shop: session.shop,
        state: session.state,
        isOnline: session.isOnline,
        scope: session.scope,
        expires: session.expires,
        payload,
      },
      update: {
        shop: session.shop,
        state: session.state,
        isOnline: session.isOnline,
        scope: session.scope ?? null,
        expires: session.expires ?? null,
        payload,
      },
    });

    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const record = await this.client.shopifySession.findUnique({ where: { id } });

    return record ? deserializeSession(record.payload) : undefined;
  }

  async deleteSession(id: string): Promise<boolean> {
    try {
      await this.client.shopifySession.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    await this.client.shopifySession.deleteMany({
      where: { id: { in: ids } },
    });

    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const records = await this.client.shopifySession.findMany({ where: { shop } });

    return records.map((record) => deserializeSession(record.payload));
  }
}

function serializeSession(session: Session): string {
  return JSON.stringify(session.toPropertyArray(true));
}

function deserializeSession(payload: string): Session {
  const properties = JSON.parse(payload) as SerializedSessionProperty[];

  return Session.fromPropertyArray(properties, true);
}
