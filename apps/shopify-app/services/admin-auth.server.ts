import type { ShopRecord, ShopRepository } from "@shoppable-video/db";

import { authenticate } from "../app/lib/shopify.server";
import { ensureShopForSession } from "./shop-lifecycle.server";

export type AuthenticatedAdminSession = {
  shop: string;
};

export type AuthenticatedAdminResult = {
  session: AuthenticatedAdminSession;
};

export type AdminAuthenticator = (request: Request) => Promise<AuthenticatedAdminResult>;

export type AdminAuthContext = {
  shop: ShopRecord;
  shopDomain: string;
};

export type AdminAuthDependencies = {
  authenticateAdmin?: AdminAuthenticator;
  shopRepository: Pick<ShopRepository, "ensureInstalled">;
};

export async function authenticateAdminRequest(
  request: Request,
  {
    authenticateAdmin = (adminRequest) => authenticate.admin(adminRequest),
    shopRepository,
  }: AdminAuthDependencies,
): Promise<AdminAuthContext> {
  const authResult = await authenticateAdmin(request);
  const shop = await ensureShopForSession(authResult.session, { shopRepository });

  return {
    shop,
    shopDomain: shop.shopDomain,
  };
}
