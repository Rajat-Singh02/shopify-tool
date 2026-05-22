import type { ShopRepository } from "@shoppable-video/db";

import {
  authenticateAdminRequest,
  type AdminAuthenticator,
} from "../services/admin-auth.server";
import { getDashboardOverview } from "../services/dashboard.server";

export type AdminDashboardLoaderDependencies = {
  authenticateAdmin?: AdminAuthenticator;
  shopRepository: Pick<ShopRepository, "ensureInstalled">;
};

export async function loadAdminDashboard(
  request: Request,
  dependencies: AdminDashboardLoaderDependencies,
) {
  const authContext = await authenticateAdminRequest(request, dependencies);

  return {
    shopDomain: authContext.shopDomain,
    overview: getDashboardOverview(),
  };
}
