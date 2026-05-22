import type { ShopRecord, ShopRepository } from "@shoppable-video/db";

export type ShopifySessionShop = {
  shop: string;
};

export type ShopLifecycleDependencies = {
  shopRepository: Pick<ShopRepository, "ensureInstalled">;
};

export async function ensureShopForSession(
  session: ShopifySessionShop,
  { shopRepository }: ShopLifecycleDependencies,
): Promise<ShopRecord> {
  return shopRepository.ensureInstalled(session.shop);
}
