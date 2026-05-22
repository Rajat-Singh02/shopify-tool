import { ShopDomainSchema } from "@shoppable-video/shared";

export type ShopRecord = {
  id: string;
  shopDomain: string;
  installedAt: Date;
  uninstalledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ShopRepositoryClient = {
  shop: {
    findUnique(args: { where: { shopDomain: string } }): Promise<ShopRecord | null>;
    create(args: {
      data: {
        shopDomain: string;
        installedAt?: Date;
        uninstalledAt?: null;
      };
    }): Promise<ShopRecord>;
    update(args: {
      where: { shopDomain: string };
      data: {
        installedAt?: Date;
        uninstalledAt?: Date | null;
      };
    }): Promise<ShopRecord>;
  };
};

export class ShopRepository {
  constructor(private readonly client: ShopRepositoryClient) {}

  async findByDomain(shopDomain: string): Promise<ShopRecord | null> {
    return this.client.shop.findUnique({
      where: { shopDomain: ShopDomainSchema.parse(shopDomain) },
    });
  }

  async ensureInstalled(shopDomain: string, installedAt = new Date()): Promise<ShopRecord> {
    const normalizedShopDomain = ShopDomainSchema.parse(shopDomain);
    const existing = await this.findByDomain(normalizedShopDomain);

    if (!existing) {
      return this.client.shop.create({
        data: {
          shopDomain: normalizedShopDomain,
          installedAt,
          uninstalledAt: null,
        },
      });
    }

    if (existing.uninstalledAt) {
      return this.client.shop.update({
        where: { shopDomain: normalizedShopDomain },
        data: {
          installedAt,
          uninstalledAt: null,
        },
      });
    }

    return existing;
  }

  async markUninstalled(shopDomain: string, uninstalledAt = new Date()): Promise<ShopRecord | null> {
    const normalizedShopDomain = ShopDomainSchema.parse(shopDomain);
    const existing = await this.findByDomain(normalizedShopDomain);

    if (!existing) {
      return null;
    }

    if (existing.uninstalledAt) {
      return existing;
    }

    return this.client.shop.update({
      where: { shopDomain: normalizedShopDomain },
      data: {
        uninstalledAt,
      },
    });
  }
}
