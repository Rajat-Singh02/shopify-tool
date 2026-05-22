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
export type AdminDashboardTokenProvider = () => Promise<string | undefined>;

type ShopifyAppBridgeGlobal = {
  idToken?: () => Promise<string>;
};

export async function getShopifyIdToken(): Promise<string | undefined> {
  if (typeof window === "undefined") {
    return undefined;
  }

  const shopify = (window as Window & { shopify?: ShopifyAppBridgeGlobal }).shopify;

  return shopify?.idToken?.();
}

export async function fetchAdminDashboardContext(
  fetcher: typeof fetch = fetch,
  tokenProvider: AdminDashboardTokenProvider = getShopifyIdToken,
): Promise<AdminDashboardData> {
  const headers = new Headers({
    Accept: "application/json",
  });
  const token = await safelyLoadDashboardToken(tokenProvider);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetcher(ADMIN_DASHBOARD_CONTEXT_PATH, {
    headers,
  });

  if (!response.ok) {
    throw new Error(ADMIN_SHELL_SAFE_ERROR_MESSAGE);
  }

  return (await response.json()) as AdminDashboardData;
}

async function safelyLoadDashboardToken(
  tokenProvider: AdminDashboardTokenProvider,
): Promise<string | undefined> {
  try {
    return await tokenProvider();
  } catch {
    return undefined;
  }
}
