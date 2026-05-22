import type { ShopRepository } from "@shoppable-video/db";

import { authenticateAdminRequest, type AdminAuthenticator } from "../services/admin-auth.server";
import { ADMIN_SHELL_SAFE_ERROR_MESSAGE, type AdminDashboardData } from "../services/admin-shell";
import { getDashboardOverview } from "../services/dashboard.server";

export type AdminDashboardLoaderDependencies = {
  authenticateAdmin?: AdminAuthenticator;
  shopRepository: Pick<ShopRepository, "ensureInstalled">;
};

export async function loadAdminDashboard(
  request: Request,
  dependencies: AdminDashboardLoaderDependencies,
): Promise<AdminDashboardData> {
  const authContext = await authenticateAdminRequest(request, dependencies);

  return {
    shop: {
      domain: authContext.shopDomain,
      installedAt: authContext.shop.installedAt.toISOString(),
    },
    overview: getDashboardOverview(),
  };
}

export async function handleAdminDashboardContextRequest(
  request: Request,
  dependencies: AdminDashboardLoaderDependencies,
): Promise<Response> {
  try {
    const dashboard = await loadAdminDashboard(request, dependencies);

    return Response.json(dashboard, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = error instanceof Response ? error.status : 410;

    return Response.json(
      {
        message: ADMIN_SHELL_SAFE_ERROR_MESSAGE,
      },
      {
        status: status >= 400 && status < 500 ? status : 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
