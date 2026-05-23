import {
  getShopifyIdToken,
  type AdminDashboardTokenProvider,
} from "./admin-shell";
import type { VideoLibraryItem } from "./video-library";

export const ADMIN_WIDGETS_PATH = "/api/admin/widgets";
export const ADMIN_WIDGETS_SAFE_ERROR_MESSAGE =
  "We could not update widgets. Reload the app from Shopify admin.";

export type AdminWidgetStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type AdminWidget = {
  id: string;
  title: string;
  status: AdminWidgetStatus;
  layout: "INLINE_CAROUSEL";
  createdAt: string;
  updatedAt: string;
  videos: VideoLibraryItem[];
};

export type AdminWidgetListResult = {
  widgets: AdminWidget[];
};

export type AdminWidgetListClient = () => Promise<AdminWidgetListResult>;
export type AdminWidgetCreateClient = (input: { title: string }) => Promise<AdminWidget>;
export type AdminWidgetDetailClient = (widgetId: string) => Promise<AdminWidget>;
export type AdminWidgetUpdateClient = (
  widgetId: string,
  input: { title?: string; status?: AdminWidgetStatus },
) => Promise<AdminWidget>;
export type AdminWidgetAttachVideoClient = (
  widgetId: string,
  videoId: string,
) => Promise<AdminWidget>;
export type AdminWidgetDetachVideoClient = (
  widgetId: string,
  videoId: string,
) => Promise<{ detached: true }>;

export async function fetchAdminWidgets(
  fetcher: typeof fetch = fetch,
  tokenProvider: AdminDashboardTokenProvider = getShopifyIdToken,
): Promise<AdminWidgetListResult> {
  const response = await fetcher(ADMIN_WIDGETS_PATH, {
    headers: await createAdminWidgetHeaders(tokenProvider),
  });

  if (!response.ok) {
    throw new Error(ADMIN_WIDGETS_SAFE_ERROR_MESSAGE);
  }

  return (await response.json()) as AdminWidgetListResult;
}

export async function createAdminWidget(
  input: { title: string },
  fetcher: typeof fetch = fetch,
  tokenProvider: AdminDashboardTokenProvider = getShopifyIdToken,
): Promise<AdminWidget> {
  const response = await fetcher(ADMIN_WIDGETS_PATH, {
    method: "POST",
    headers: await createAdminWidgetHeaders(tokenProvider, true),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(ADMIN_WIDGETS_SAFE_ERROR_MESSAGE);
  }

  return ((await response.json()) as { widget: AdminWidget }).widget;
}

export async function fetchAdminWidgetDetail(
  widgetId: string,
  fetcher: typeof fetch = fetch,
  tokenProvider: AdminDashboardTokenProvider = getShopifyIdToken,
): Promise<AdminWidget> {
  const response = await fetcher(toAdminWidgetPath(widgetId), {
    headers: await createAdminWidgetHeaders(tokenProvider),
  });

  if (!response.ok) {
    throw new Error(ADMIN_WIDGETS_SAFE_ERROR_MESSAGE);
  }

  return ((await response.json()) as { widget: AdminWidget }).widget;
}

export async function updateAdminWidget(
  widgetId: string,
  input: { title?: string; status?: AdminWidgetStatus },
  fetcher: typeof fetch = fetch,
  tokenProvider: AdminDashboardTokenProvider = getShopifyIdToken,
): Promise<AdminWidget> {
  const response = await fetcher(toAdminWidgetPath(widgetId), {
    method: "PATCH",
    headers: await createAdminWidgetHeaders(tokenProvider, true),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(ADMIN_WIDGETS_SAFE_ERROR_MESSAGE);
  }

  return ((await response.json()) as { widget: AdminWidget }).widget;
}

export async function attachAdminWidgetVideo(
  widgetId: string,
  videoId: string,
  fetcher: typeof fetch = fetch,
  tokenProvider: AdminDashboardTokenProvider = getShopifyIdToken,
): Promise<AdminWidget> {
  const response = await fetcher(`${toAdminWidgetPath(widgetId)}/videos`, {
    method: "POST",
    headers: await createAdminWidgetHeaders(tokenProvider, true),
    body: JSON.stringify({ videoId }),
  });

  if (!response.ok) {
    throw new Error(ADMIN_WIDGETS_SAFE_ERROR_MESSAGE);
  }

  return ((await response.json()) as { widget: AdminWidget }).widget;
}

export async function detachAdminWidgetVideo(
  widgetId: string,
  videoId: string,
  fetcher: typeof fetch = fetch,
  tokenProvider: AdminDashboardTokenProvider = getShopifyIdToken,
): Promise<{ detached: true }> {
  const response = await fetcher(
    `${toAdminWidgetPath(widgetId)}/videos/${encodeURIComponent(videoId)}`,
    {
      method: "DELETE",
      headers: await createAdminWidgetHeaders(tokenProvider),
    },
  );

  if (!response.ok) {
    throw new Error(ADMIN_WIDGETS_SAFE_ERROR_MESSAGE);
  }

  return (await response.json()) as { detached: true };
}

function toAdminWidgetPath(widgetId: string): string {
  return `${ADMIN_WIDGETS_PATH}/${encodeURIComponent(widgetId)}`;
}

async function createAdminWidgetHeaders(
  tokenProvider: AdminDashboardTokenProvider,
  includeJson = false,
): Promise<Headers> {
  const headers = new Headers({
    Accept: "application/json",
  });
  const token = await safelyLoadAdminWidgetToken(tokenProvider);

  if (includeJson) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

async function safelyLoadAdminWidgetToken(
  tokenProvider: AdminDashboardTokenProvider,
): Promise<string | undefined> {
  try {
    return await tokenProvider();
  } catch {
    return undefined;
  }
}
