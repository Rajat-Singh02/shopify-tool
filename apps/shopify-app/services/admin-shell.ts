export const ADMIN_DASHBOARD_CONTEXT_PATH = "/api/admin/dashboard";

export const ADMIN_SHELL_SAFE_ERROR_MESSAGE =
  "We could not load the authenticated shop context. Reload the app from Shopify admin.";

export type DashboardOverview = {
  activeScopeLabel: "Manual upload only";
};

export type AdminDashboardData = {
  shop: {
    domain: string;
    installedAt: string;
  };
  overview: DashboardOverview;
};

export type AdminDashboardState =
  | { status: "loading" }
  | { status: "ready"; data: AdminDashboardData }
  | { status: "error"; message: string };

export type AdminDashboardContextLoader = () => Promise<AdminDashboardData>;

export async function fetchAdminDashboardContext(
  fetcher: typeof fetch = fetch,
): Promise<AdminDashboardData> {
  const response = await fetcher(ADMIN_DASHBOARD_CONTEXT_PATH, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(ADMIN_SHELL_SAFE_ERROR_MESSAGE);
  }

  return (await response.json()) as AdminDashboardData;
}
