import type { ShopRecord, ShopRepository } from "@shoppable-video/db";

export type ShopifySessionShop = {
  shop: string;
};

export async function ensureShopForSession(
  session: ShopifySessionShop,
  { shopRepository }: { shopRepository: Pick<ShopRepository, "ensureInstalled"> },
): Promise<ShopRecord> {
  return shopRepository.ensureInstalled(session.shop);
}

export async function markShopUninstalled(
  shopDomain: string,
  { shopRepository }: { shopRepository: Pick<ShopRepository, "markUninstalled"> },
): Promise<ShopRecord | null> {
  return shopRepository.markUninstalled(shopDomain);
}
