export type RepositoryContext = {
  shopId: string;
};

export class TenantScopeError extends Error {
  constructor(message = "A shop-scoped repository operation requires a shop ID") {
    super(message);
    this.name = "TenantScopeError";
  }
}

export function assertShopScope(context: RepositoryContext): string {
  if (!context.shopId) {
    throw new TenantScopeError();
  }

  return context.shopId;
}

export { createPrismaClient, getPrismaClient } from "./prisma";
export { ShopRepository, type ShopRecord, type ShopRepositoryClient } from "./repositories/shop-repository";
export {
  PrismaShopifySessionStorage,
  type ShopifySessionRecord,
  type ShopifySessionStorageClient,
} from "./shopify-session-storage";
