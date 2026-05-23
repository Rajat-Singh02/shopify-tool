import { createHash } from "node:crypto";
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";

import {
  getAdminAnalyticsSummary,
  listAdminAnalyticsEvents,
  AdminAnalyticsExpectedError,
  type AdminAnalyticsEventsResponse,
  type AdminAnalyticsSummaryResponse,
} from "./admin-analytics.js";
import {
  attachAdminWidgetVideo,
  createAdminWidget,
  detachAdminWidgetVideo,
  getAdminWidget,
  listAdminWidgets,
  updateAdminWidget,
  AdminWidgetExpectedError,
  type AdminWidgetListResponse,
  type SafeAdminWidgetDto,
} from "./admin-widgets.js";
import {
  archiveVideoLibraryItem,
  getVideoLibraryDetail,
  listVideoLibrary,
  VideoLibraryExpectedError,
  type SafeVideoLibraryDto,
  type VideoLibraryListResponse,
} from "./video-library.js";
import {
  createStorefrontWidgetBootstrapScript,
  getStorefrontWidgetPayload,
  StorefrontWidgetExpectedError,
  type PublicStorefrontWidgetPayload,
} from "./storefront-widget.js";
import {
  ingestStorefrontAnalyticsEvent,
  StorefrontAnalyticsExpectedError,
  type StorefrontAnalyticsResponse,
} from "./storefront-analytics.js";
import {
  completeManualUpload,
  createManualUploadIntent,
  createStorageProviderFromEnv,
  toSafeVideoDto,
  VideoUploadExpectedError,
  writeManualUploadObject,
  type SafeVideoDto,
  type StorageProvider,
  type UploadIntentResult,
  type VideoProcessingDispatcher,
  type VideoUploadShop,
} from "./video-upload.js";
import {
  createVideoProductTag,
  deleteVideoProductTag,
  listVideoProductTags,
  VideoProductTagExpectedError,
  type SafeVideoProductTagDto,
  type VideoProductTagsListResponse,
} from "./video-product-tags.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

type VercelRuntimeRoute =
  | "admin-analytics"
  | "admin-dashboard"
  | "admin-widget"
  | "auth"
  | "health"
  | "product-search"
  | "storefront-event"
  | "storefront-widget"
  | "video-library"
  | "video-product-tags"
  | "video-upload"
  | "webhook"
  | "not-found";

type AdminSession = {
  shop: string;
};

type AdminAuthResult = {
  session: AdminSession;
};

type DashboardShopRecord = {
  id: string;
  shopDomain: string;
  installedAt: Date;
};

type ProductSearchSession = {
  shop: string;
  accessToken: string;
};

type ProductSearchInput = {
  q?: string | null;
  first?: number | null;
  after?: string | null;
};

type ProductSearchResponse = {
  products: Array<{
    id: string;
    title: string;
    handle: string;
    status: string;
    featuredImage: {
      url: string;
      altText: string | null;
    } | null;
    variants: Array<{
      id: string;
      title: string;
      sku: string | null;
      price: string;
      inventoryQuantity: number | null;
    }>;
  }>;
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
};

type WebhookContext = {
  shop: string;
  topic: string;
  webhookId?: string;
  eventId?: string;
};

type RuntimeDependencies = {
  authenticateAdmin?: (request: Request) => Promise<AdminAuthResult>;
  authenticateWebhook?: (request: Request) => Promise<WebhookContext>;
  handleAdminDashboard?: (request: Request) => Promise<Response>;
  handleAdminAnalytics?: (request: Request) => Promise<Response>;
  handleAdminWidget?: (request: Request) => Promise<Response>;
  handleProductSearch?: (request: Request) => Promise<Response>;
  handleStorefrontEvent?: (request: Request) => Promise<Response>;
  handleStorefrontWidget?: (request: Request) => Promise<Response>;
  handleVideoLibrary?: (request: Request) => Promise<Response>;
  handleVideoProductTags?: (request: Request) => Promise<Response>;
  handleVideoUpload?: (request: Request) => Promise<Response>;
  handleWebhook?: (request: Request) => Promise<Response>;
  loadDashboardShop?: (shopDomain: string) => Promise<DashboardShopRecord>;
  loadVideoUploadShop?: (shopDomain: string) => Promise<VideoUploadShop>;
  loadProductSearchSession?: (shopDomain: string) => Promise<ProductSearchSession | undefined>;
  searchProducts?: (
    session: ProductSearchSession,
    input: ProductSearchInput,
  ) => Promise<ProductSearchResponse>;
  loadStorefrontWidget?: (
    shopDomain: string,
    widgetId: string,
  ) => Promise<PublicStorefrontWidgetPayload>;
  recordStorefrontEvent?: (input: unknown) => Promise<StorefrontAnalyticsResponse>;
  getAdminAnalyticsSummary?: (
    shop: VideoUploadShop,
    query: URLSearchParams,
  ) => Promise<AdminAnalyticsSummaryResponse>;
  listAdminAnalyticsEvents?: (
    shop: VideoUploadShop,
    query: URLSearchParams,
  ) => Promise<AdminAnalyticsEventsResponse>;
  listAdminWidgets?: (shop: VideoUploadShop) => Promise<AdminWidgetListResponse>;
  createAdminWidget?: (shop: VideoUploadShop, input: unknown) => Promise<SafeAdminWidgetDto>;
  getAdminWidget?: (shop: VideoUploadShop, widgetId: string) => Promise<SafeAdminWidgetDto>;
  updateAdminWidget?: (
    shop: VideoUploadShop,
    widgetId: string,
    input: unknown,
  ) => Promise<SafeAdminWidgetDto>;
  attachAdminWidgetVideo?: (
    shop: VideoUploadShop,
    widgetId: string,
    input: unknown,
  ) => Promise<SafeAdminWidgetDto>;
  detachAdminWidgetVideo?: (
    shop: VideoUploadShop,
    widgetId: string,
    videoId: string,
  ) => Promise<{ detached: true }>;
  createUploadIntent?: (
    shop: VideoUploadShop,
    input: unknown,
  ) => Promise<UploadIntentResult>;
  writeUploadObject?: (
    shop: VideoUploadShop,
    videoId: string,
    request: Request,
  ) => Promise<SafeVideoDto>;
  completeUpload?: (shop: VideoUploadShop, videoId: string) => Promise<SafeVideoDto>;
  dispatchVideoProcessingJob?: (
    shop: VideoUploadShop,
    videoId: string,
  ) => Promise<SafeVideoDto>;
  listVideos?: (
    shop: VideoUploadShop,
    query: URLSearchParams,
  ) => Promise<VideoLibraryListResponse>;
  getVideo?: (shop: VideoUploadShop, videoId: string) => Promise<SafeVideoLibraryDto>;
  archiveVideo?: (shop: VideoUploadShop, videoId: string) => Promise<SafeVideoLibraryDto>;
  listVideoProductTags?: (
    shop: VideoUploadShop,
    videoId: string,
  ) => Promise<VideoProductTagsListResponse>;
  createVideoProductTag?: (
    shop: VideoUploadShop,
    videoId: string,
    input: unknown,
  ) => Promise<SafeVideoProductTagDto>;
  deleteVideoProductTag?: (
    shop: VideoUploadShop,
    videoId: string,
    tagId: string,
  ) => Promise<{ deleted: true }>;
};

type DashboardDiagnosticError = Error & {
  code?: unknown;
  clientVersion?: unknown;
  meta?: unknown;
};
type SafeDiagnosticValue = string | number | boolean | null;

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  await handleNodeServerRequest(request, response);
}

export function resolveVercelRuntimeRoute(pathname: string): VercelRuntimeRoute {
  if (pathname === "/api/admin/analytics/summary" || pathname === "/api/admin/analytics/events") {
    return "admin-analytics";
  }

  if (pathname === "/api/storefront/events") {
    return "storefront-event";
  }

  if (pathname === "/widget.js" || /^\/api\/storefront\/widgets\/[^/]+$/.test(pathname)) {
    return "storefront-widget";
  }

  if (pathname === "/api/admin/dashboard" || pathname === "/api/admin-dashboard") {
    return "admin-dashboard";
  }

  if (
    pathname === "/api/admin/widgets" ||
    /^\/api\/admin\/widgets\/[^/]+(?:\/videos(?:\/[^/]+)?)?$/.test(pathname)
  ) {
    return "admin-widget";
  }

  if (
    pathname === "/api/admin/products/search" ||
    pathname === "/api/admin-products-search"
  ) {
    return "product-search";
  }

  const normalizedVideoPath = pathname.replace(/^\/api\/admin-videos/, "/api/admin/videos");

  if (
    normalizedVideoPath === "/api/admin/videos/upload-intent" ||
    /^\/api\/admin\/videos\/[^/]+\/(upload|complete-upload)$/.test(normalizedVideoPath)
  ) {
    return "video-upload";
  }

  if (
    /^\/api\/admin\/videos\/[^/]+\/product-tags(?:\/[^/]+)?$/.test(normalizedVideoPath)
  ) {
    return "video-product-tags";
  }

  if (
    normalizedVideoPath === "/api/admin/videos" ||
    /^\/api\/admin\/videos\/[^/]+(\/archive|\/restore)?$/.test(normalizedVideoPath)
  ) {
    return "video-library";
  }

  if (pathname === "/api/webhooks" || pathname === "/webhooks") {
    return "webhook";
  }

  if (pathname === "/api/health" || pathname === "/health") {
    return "health";
  }

  if (
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/")
  ) {
    return "auth";
  }

  return "not-found";
}

export async function handleVercelRuntimeRequest(
  request: Request,
  dependencies: RuntimeDependencies = {},
): Promise<Response> {
  const route = resolveVercelRuntimeRoute(new URL(request.url).pathname);

  if (route === "health") {
    return Response.json(
      {
        status: "ok",
        service: "shoppable-video-shopify-app",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (route === "admin-dashboard") {
    return handleAdminDashboardRequest(request, dependencies);
  }

  if (route === "admin-analytics") {
    return handleAdminAnalyticsRequest(request, dependencies);
  }

  if (route === "admin-widget") {
    return handleAdminWidgetRequest(request, dependencies);
  }

  if (route === "product-search") {
    return handleProductSearchRequest(request, dependencies);
  }

  if (route === "storefront-widget") {
    return handleStorefrontWidgetRequest(request, dependencies);
  }

  if (route === "storefront-event") {
    return handleStorefrontEventRequest(request, dependencies);
  }

  if (route === "video-library") {
    return handleVideoLibraryRequest(request, dependencies);
  }

  if (route === "video-product-tags") {
    return handleVideoProductTagsRequest(request, dependencies);
  }

  if (route === "video-upload") {
    return handleVideoUploadRequest(request, dependencies);
  }

  if (route === "webhook") {
    return handleWebhookRequest(request, dependencies);
  }

  if (route === "auth") {
    return handleAuthRequest(request, dependencies);
  }

  return Response.json({ message: "Not found" }, { status: 404 });
}

export async function handleNodeServerRequest(
  nodeRequest: IncomingMessage,
  nodeResponse: ServerResponse,
): Promise<void> {
  const request = await toFetchRequest(nodeRequest);
  const response = await handleVercelRuntimeRequest(request);

  await writeNodeResponse(nodeResponse, response);
}

async function handleAdminDashboardRequest(
  request: Request,
  { authenticateAdmin, handleAdminDashboard, loadDashboardShop }: RuntimeDependencies,
): Promise<Response> {
  if (handleAdminDashboard) {
    return handleAdminDashboard(request);
  }

  if (!authenticateAdmin && !hasBearerAuthorization(request)) {
    return dashboardAuthFailureResponse(410);
  }

  let authenticated = false;

  try {
    const authResult = await authenticateDashboardRequest(request, authenticateAdmin);
    authenticated = true;
    const shop = loadDashboardShop
      ? await loadDashboardShop(authResult.session.shop)
      : await loadDashboardShopFromDatabase(authResult.session.shop);

    return Response.json(
      {
        shop: {
          domain: shop.shopDomain,
          installedAt: shop.installedAt.toISOString(),
        },
        overview: {
          activeScopeLabel: "Manual upload only",
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const status = error instanceof Response ? error.status : authenticated ? 500 : 410;

    if (authenticated && !(error instanceof Response)) {
      logDashboardShopContextError(error);
    }

    return dashboardAuthFailureResponse(status >= 400 && status < 500 ? status : 500);
  }
}

async function handleProductSearchRequest(
  request: Request,
  {
    authenticateAdmin,
    handleProductSearch,
    loadProductSearchSession,
    searchProducts,
  }: RuntimeDependencies,
): Promise<Response> {
  if (handleProductSearch) {
    return handleProductSearch(request);
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return productSearchFailureResponse(405, "Product search only supports GET requests.");
  }

  if (!authenticateAdmin && !hasBearerAuthorization(request)) {
    return productSearchFailureResponse(410);
  }

  let authenticated = false;

  try {
    const authResult = await authenticateDashboardRequest(request, authenticateAdmin);
    authenticated = true;
    const session = loadProductSearchSession
      ? await loadProductSearchSession(authResult.session.shop)
      : await loadProductSearchSessionFromDatabase(authResult.session.shop);

    if (!session) {
      return productSearchFailureResponse(410);
    }

    const input = parseProductSearchRequestInput(request);
    const result = searchProducts
      ? await searchProducts(session, input)
      : await searchProductsWithShopifyAdmin(session, input);

    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    if (error instanceof ProductSearchExpectedError) {
      logProductSearchError(error);
      return productSearchFailureResponse(error.status, error.clientMessage);
    }

    const status = authenticated ? 500 : 410;

    if (authenticated) {
      logProductSearchError(error);
    }

    return productSearchFailureResponse(status >= 400 && status < 500 ? status : 500);
  }
}

function parseProductSearchRequestInput(request: Request): ProductSearchInput {
  const url = new URL(request.url);
  const firstParam = url.searchParams.get("first");

  return {
    q: url.searchParams.get("q"),
    first: firstParam ? Number(firstParam) : undefined,
    after: url.searchParams.get("after"),
  };
}

async function loadProductSearchSessionFromDatabase(
  shopDomain: string,
): Promise<ProductSearchSession | undefined> {
  const { getPrismaClient, PrismaShopifySessionStorage } = await import("@shoppable-video/db");
  const sessionStorage = new PrismaShopifySessionStorage(getPrismaClient());
  const sessions = await sessionStorage.findSessionsByShop(shopDomain);
  const offlineSession = sessions.find(
    (session) => !session.isOnline && typeof session.accessToken === "string",
  );

  if (!offlineSession?.accessToken) {
    return undefined;
  }

  return {
    shop: offlineSession.shop,
    accessToken: offlineSession.accessToken,
  };
}

async function searchProductsWithShopifyAdmin(
  session: ProductSearchSession,
  input: ProductSearchInput,
): Promise<ProductSearchResponse> {
  const { searchShopifyProducts } = await import("@shoppable-video/shopify");

  return searchShopifyProducts(createShopifyAdminGraphqlClient(session), input);
}

function createShopifyAdminGraphqlClient(session: ProductSearchSession) {
  const env = parseEnv(process.env);
  const endpoint = `https://${session.shop}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`;

  return {
    async request<TData>(query: string, variables: Record<string, unknown>): Promise<TData> {
      let response: Response;

      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": session.accessToken,
          },
          body: JSON.stringify({ query, variables }),
        });
      } catch {
        throw new ProductSearchExpectedError(
          "Shopify Admin API request failed",
          502,
          "Unable to search Shopify products right now.",
        );
      }

      if (!response.ok) {
        throw new ProductSearchExpectedError(
          `Shopify Admin API returned HTTP ${response.status}`,
          502,
          "Unable to search Shopify products right now.",
        );
      }

      const payload = (await response.json()) as {
        data?: TData;
        errors?: unknown;
      };

      if (payload.errors || !payload.data) {
        throw new ProductSearchExpectedError(
          "Shopify Admin API returned GraphQL errors",
          502,
          "Unable to search Shopify products right now.",
        );
      }

      return payload.data;
    },
  };
}

class ProductSearchExpectedError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly clientMessage: string,
  ) {
    super(message);
    this.name = "ProductSearchExpectedError";
  }
}

function logProductSearchError(error: unknown): void {
  const reason = error instanceof Error ? error.name : "UnknownProductSearchError";

  console.error("Failed to search Shopify products", {
    operation: "products.search",
    reason,
  });
}

function productSearchFailureResponse(
  status: number,
  message = "We could not search Shopify products. Reload the app from Shopify admin.",
): Response {
  return Response.json(
    {
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function handleAdminAnalyticsRequest(
  request: Request,
  {
    authenticateAdmin,
    getAdminAnalyticsSummary: getSummary,
    handleAdminAnalytics,
    listAdminAnalyticsEvents: listEvents,
    loadVideoUploadShop,
  }: RuntimeDependencies,
): Promise<Response> {
  if (handleAdminAnalytics) {
    return handleAdminAnalytics(request);
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return adminAnalyticsFailureResponse(405, "Analytics endpoints only support GET requests.");
  }

  if (!authenticateAdmin && !hasBearerAuthorization(request)) {
    return adminAnalyticsFailureResponse(410);
  }

  let authenticated = false;

  try {
    const authResult = await authenticateDashboardRequest(request, authenticateAdmin);
    authenticated = true;
    const shop = loadVideoUploadShop
      ? await loadVideoUploadShop(authResult.session.shop)
      : await loadVideoUploadShopFromDatabase(authResult.session.shop);
    const url = new URL(request.url);

    if (url.pathname === "/api/admin/analytics/summary") {
      const result = getSummary
        ? await getSummary(shop, url.searchParams)
        : await getAdminAnalyticsSummaryWithDatabase(shop, url.searchParams);

      return Response.json(result, {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    const result = listEvents
      ? await listEvents(shop, url.searchParams)
      : await listAdminAnalyticsEventsWithDatabase(shop, url.searchParams);

    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    if (error instanceof AdminAnalyticsExpectedError) {
      logAdminAnalyticsError(error);
      return adminAnalyticsFailureResponse(error.status, error.clientMessage);
    }

    const status = authenticated ? 500 : 410;

    if (authenticated) {
      logAdminAnalyticsError(error);
    }

    return adminAnalyticsFailureResponse(status >= 400 && status < 500 ? status : 500);
  }
}

async function getAdminAnalyticsSummaryWithDatabase(
  shop: VideoUploadShop,
  query: URLSearchParams,
): Promise<AdminAnalyticsSummaryResponse> {
  const { AnalyticsEventRepository, VideoRepository, WidgetRepository, getPrismaClient } =
    await import("@shoppable-video/db");
  const prismaClient = getPrismaClient();

  return getAdminAnalyticsSummary({
    shop,
    query: toAdminAnalyticsQuery(query),
    analyticsEventRepository: new AnalyticsEventRepository(prismaClient),
    widgetRepository: new WidgetRepository(prismaClient),
    videoRepository: new VideoRepository(prismaClient),
  });
}

async function listAdminAnalyticsEventsWithDatabase(
  shop: VideoUploadShop,
  query: URLSearchParams,
): Promise<AdminAnalyticsEventsResponse> {
  const { AnalyticsEventRepository, VideoRepository, WidgetRepository, getPrismaClient } =
    await import("@shoppable-video/db");
  const prismaClient = getPrismaClient();

  return listAdminAnalyticsEvents({
    shop,
    query: toAdminAnalyticsQuery(query),
    analyticsEventRepository: new AnalyticsEventRepository(prismaClient),
    widgetRepository: new WidgetRepository(prismaClient),
    videoRepository: new VideoRepository(prismaClient),
  });
}

function toAdminAnalyticsQuery(query: URLSearchParams) {
  return {
    first: query.get("first"),
    after: query.get("after"),
    from: query.get("from"),
    to: query.get("to"),
    eventType: query.get("eventType"),
    widgetId: query.get("widgetId"),
    videoId: query.get("videoId"),
  };
}

function logAdminAnalyticsError(error: unknown): void {
  const reason = error instanceof Error ? error.name : "UnknownAdminAnalyticsError";

  console.error("Failed to handle admin analytics request", {
    operation: "analytics.admin",
    reason,
  });
}

function adminAnalyticsFailureResponse(
  status: number,
  message = "We could not load analytics. Reload the app from Shopify admin.",
): Response {
  return Response.json(
    {
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function handleAdminWidgetRequest(
  request: Request,
  {
    authenticateAdmin,
    attachAdminWidgetVideo: attachVideo,
    createAdminWidget: createWidget,
    detachAdminWidgetVideo: detachVideo,
    getAdminWidget: getWidget,
    handleAdminWidget,
    listAdminWidgets: listWidgets,
    loadVideoUploadShop,
    updateAdminWidget: updateWidget,
  }: RuntimeDependencies,
): Promise<Response> {
  if (handleAdminWidget) {
    return handleAdminWidget(request);
  }

  if (!authenticateAdmin && !hasBearerAuthorization(request)) {
    return adminWidgetFailureResponse(410);
  }

  let authenticated = false;

  try {
    const authResult = await authenticateDashboardRequest(request, authenticateAdmin);
    authenticated = true;
    const shop = loadVideoUploadShop
      ? await loadVideoUploadShop(authResult.session.shop)
      : await loadVideoUploadShopFromDatabase(authResult.session.shop);
    const action = parseAdminWidgetAction(request);

    if (action.kind === "list") {
      if (request.method !== "GET") {
        return adminWidgetFailureResponse(405, "Widget listing only supports GET requests.");
      }

      const result = listWidgets
        ? await listWidgets(shop)
        : await listAdminWidgetsWithDatabase(shop);

      return Response.json(result, {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    if (action.kind === "create") {
      if (request.method !== "POST") {
        return adminWidgetFailureResponse(405, "Widget creation only supports POST requests.");
      }

      const body = await parseAdminWidgetJsonRequestBody(request);
      const widget = createWidget
        ? await createWidget(shop, body)
        : await createAdminWidgetWithDatabase(shop, body);

      return Response.json(
        {
          widget,
        },
        {
          status: 201,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (action.kind === "detail") {
      if (request.method !== "GET") {
        return adminWidgetFailureResponse(405, "Widget detail only supports GET requests.");
      }

      const widget = getWidget
        ? await getWidget(shop, action.widgetId)
        : await getAdminWidgetWithDatabase(shop, action.widgetId);

      return Response.json(
        {
          widget,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (action.kind === "update") {
      if (request.method !== "PATCH") {
        return adminWidgetFailureResponse(405, "Widget update only supports PATCH requests.");
      }

      const body = await parseAdminWidgetJsonRequestBody(request);
      const widget = updateWidget
        ? await updateWidget(shop, action.widgetId, body)
        : await updateAdminWidgetWithDatabase(shop, action.widgetId, body);

      return Response.json(
        {
          widget,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (action.kind === "attach-video") {
      if (request.method !== "POST") {
        return adminWidgetFailureResponse(405, "Widget video attach only supports POST requests.");
      }

      const body = await parseAdminWidgetJsonRequestBody(request);
      const widget = attachVideo
        ? await attachVideo(shop, action.widgetId, body)
        : await attachAdminWidgetVideoWithDatabase(shop, action.widgetId, body);

      return Response.json(
        {
          widget,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (request.method !== "DELETE") {
      return adminWidgetFailureResponse(405, "Widget video detach only supports DELETE requests.");
    }

    const result = detachVideo
      ? await detachVideo(shop, action.widgetId, action.videoId)
      : await detachAdminWidgetVideoWithDatabase(shop, action.widgetId, action.videoId);

    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    if (error instanceof AdminWidgetExpectedError) {
      logAdminWidgetError(error);
      return adminWidgetFailureResponse(error.status, error.clientMessage);
    }

    const status = authenticated ? 500 : 410;

    if (authenticated) {
      logAdminWidgetError(error);
    }

    return adminWidgetFailureResponse(status >= 400 && status < 500 ? status : 500);
  }
}

type AdminWidgetAction =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "detail"; widgetId: string }
  | { kind: "update"; widgetId: string }
  | { kind: "attach-video"; widgetId: string }
  | { kind: "detach-video"; widgetId: string; videoId: string };

function parseAdminWidgetAction(request: Request): AdminWidgetAction {
  const pathname = new URL(request.url).pathname;

  if (pathname === "/api/admin/widgets") {
    return request.method === "POST" ? { kind: "create" } : { kind: "list" };
  }

  const match = pathname.match(/^\/api\/admin\/widgets\/([^/]+)(?:\/videos(?:\/([^/]+))?)?$/);

  if (!match?.[1]) {
    throw new AdminWidgetExpectedError("Widget route was not found", 404);
  }

  const widgetId = decodeURIComponent(match[1]);

  if (match[2]) {
    return {
      kind: "detach-video",
      widgetId,
      videoId: decodeURIComponent(match[2]),
    };
  }

  if (pathname.endsWith("/videos")) {
    return {
      kind: "attach-video",
      widgetId,
    };
  }

  return request.method === "PATCH" ? { kind: "update", widgetId } : { kind: "detail", widgetId };
}

async function parseAdminWidgetJsonRequestBody(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new AdminWidgetExpectedError("Request body must be valid JSON", 400);
  }
}

async function listAdminWidgetsWithDatabase(shop: VideoUploadShop): Promise<AdminWidgetListResponse> {
  const { getPrismaClient, WidgetRepository } = await import("@shoppable-video/db");

  return listAdminWidgets({
    shop,
    widgetRepository: new WidgetRepository(getPrismaClient()),
  });
}

async function createAdminWidgetWithDatabase(
  shop: VideoUploadShop,
  input: unknown,
): Promise<SafeAdminWidgetDto> {
  const { getPrismaClient, WidgetRepository } = await import("@shoppable-video/db");

  return createAdminWidget({
    shop,
    input,
    widgetRepository: new WidgetRepository(getPrismaClient()),
  });
}

async function getAdminWidgetWithDatabase(
  shop: VideoUploadShop,
  widgetId: string,
): Promise<SafeAdminWidgetDto> {
  const { getPrismaClient, WidgetRepository } = await import("@shoppable-video/db");

  return getAdminWidget({
    shop,
    widgetId,
    widgetRepository: new WidgetRepository(getPrismaClient()),
  });
}

async function updateAdminWidgetWithDatabase(
  shop: VideoUploadShop,
  widgetId: string,
  input: unknown,
): Promise<SafeAdminWidgetDto> {
  const { getPrismaClient, WidgetRepository } = await import("@shoppable-video/db");

  return updateAdminWidget({
    shop,
    widgetId,
    input,
    widgetRepository: new WidgetRepository(getPrismaClient()),
  });
}

async function attachAdminWidgetVideoWithDatabase(
  shop: VideoUploadShop,
  widgetId: string,
  input: unknown,
): Promise<SafeAdminWidgetDto> {
  const { getPrismaClient, VideoRepository, WidgetRepository } = await import("@shoppable-video/db");
  const prismaClient = getPrismaClient();

  return attachAdminWidgetVideo({
    shop,
    widgetId,
    input,
    widgetRepository: new WidgetRepository(prismaClient),
    videoRepository: new VideoRepository(prismaClient),
  });
}

async function detachAdminWidgetVideoWithDatabase(
  shop: VideoUploadShop,
  widgetId: string,
  videoId: string,
): Promise<{ detached: true }> {
  const { getPrismaClient, WidgetRepository } = await import("@shoppable-video/db");

  return detachAdminWidgetVideo({
    shop,
    widgetId,
    videoId,
    widgetRepository: new WidgetRepository(getPrismaClient()),
  });
}

function logAdminWidgetError(error: unknown): void {
  const reason = error instanceof Error ? error.name : "UnknownAdminWidgetError";

  console.error("Failed to handle admin widget request", {
    operation: "widgets.admin",
    reason,
  });
}

function adminWidgetFailureResponse(
  status: number,
  message = "We could not update widgets. Reload the app from Shopify admin.",
): Response {
  return Response.json(
    {
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function handleStorefrontEventRequest(
  request: Request,
  { handleStorefrontEvent, recordStorefrontEvent }: RuntimeDependencies,
): Promise<Response> {
  if (handleStorefrontEvent) {
    return handleStorefrontEvent(request);
  }

  if (request.method !== "POST") {
    return storefrontEventFailureResponse(405, "Storefront events only support POST requests.");
  }

  const contentType = request.headers.get("Content-Type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return storefrontEventFailureResponse(415, "Storefront events require JSON.");
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > 8192) {
    return storefrontEventFailureResponse(413, "Storefront event payload is too large.");
  }

  try {
    const body = await parseStorefrontEventJsonRequestBody(request);
    const result = recordStorefrontEvent
      ? await recordStorefrontEvent(body)
      : await recordStorefrontEventWithDatabase(body);

    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof StorefrontAnalyticsExpectedError) {
      return storefrontEventFailureResponse(error.status, error.clientMessage);
    }

    logStorefrontEventError(error);
    return storefrontEventFailureResponse(500);
  }
}

async function parseStorefrontEventJsonRequestBody(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new StorefrontAnalyticsExpectedError("Request body must be valid JSON", 400);
  }
}

async function recordStorefrontEventWithDatabase(
  input: unknown,
): Promise<StorefrontAnalyticsResponse> {
  const { AnalyticsEventRepository, WidgetRepository, getPrismaClient } = await import(
    "@shoppable-video/db"
  );
  const prismaClient = getPrismaClient();

  return ingestStorefrontAnalyticsEvent({
    input,
    widgetRepository: new WidgetRepository(prismaClient),
    analyticsEventRepository: new AnalyticsEventRepository(prismaClient),
  });
}

function logStorefrontEventError(error: unknown): void {
  const reason = error instanceof Error ? error.name : "UnknownStorefrontEventError";

  console.error("Failed to handle storefront analytics event", {
    operation: "storefront.events",
    reason,
  });
}

function storefrontEventFailureResponse(
  status: number,
  message = "We could not record the storefront event.",
): Response {
  return Response.json(
    {
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function handleStorefrontWidgetRequest(
  request: Request,
  { handleStorefrontWidget, loadStorefrontWidget }: RuntimeDependencies,
): Promise<Response> {
  if (handleStorefrontWidget) {
    return handleStorefrontWidget(request);
  }

  const url = new URL(request.url);

  if (url.pathname === "/widget.js") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return storefrontWidgetFailureResponse(405, "Widget script only supports GET requests.");
    }

    return new Response(createStorefrontWidgetBootstrapScript(), {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Content-Type": "application/javascript; charset=utf-8",
      },
    });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return storefrontWidgetFailureResponse(405, "Storefront widget only supports GET requests.");
  }

  try {
    const widgetId = parseStorefrontWidgetId(url.pathname);
    const shopDomain = url.searchParams.get("shop");
    const result = loadStorefrontWidget
      ? await loadStorefrontWidget(shopDomain ?? "", widgetId)
      : await loadStorefrontWidgetFromDatabase(shopDomain ?? "", widgetId);

    return Response.json(result, {
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error) {
    if (error instanceof StorefrontWidgetExpectedError) {
      return storefrontWidgetFailureResponse(error.status, error.clientMessage);
    }

    logStorefrontWidgetError(error);
    return storefrontWidgetFailureResponse(500);
  }
}

function parseStorefrontWidgetId(pathname: string): string {
  const match = pathname.match(/^\/api\/storefront\/widgets\/([^/]+)$/);

  if (!match?.[1]) {
    throw new StorefrontWidgetExpectedError("Widget was not found", 404);
  }

  return decodeURIComponent(match[1]);
}

async function loadStorefrontWidgetFromDatabase(
  shopDomain: string,
  widgetId: string,
): Promise<PublicStorefrontWidgetPayload> {
  const { getPrismaClient, WidgetRepository } = await import("@shoppable-video/db");

  return getStorefrontWidgetPayload({
    shop: shopDomain,
    widgetId,
    widgetRepository: new WidgetRepository(getPrismaClient()),
  });
}

function logStorefrontWidgetError(error: unknown): void {
  const reason = error instanceof Error ? error.name : "UnknownStorefrontWidgetError";

  console.error("Failed to handle storefront widget request", {
    operation: "storefront.widget",
    reason,
  });
}

function storefrontWidgetFailureResponse(
  status: number,
  message = "We could not load the storefront widget.",
): Response {
  return Response.json(
    {
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function handleVideoLibraryRequest(
  request: Request,
  {
    authenticateAdmin,
    archiveVideo,
    getVideo,
    handleVideoLibrary,
    listVideos,
    loadVideoUploadShop,
  }: RuntimeDependencies,
): Promise<Response> {
  if (handleVideoLibrary) {
    return handleVideoLibrary(request);
  }

  if (!authenticateAdmin && !hasBearerAuthorization(request)) {
    return videoLibraryFailureResponse(410);
  }

  let authenticated = false;

  try {
    const authResult = await authenticateDashboardRequest(request, authenticateAdmin);
    authenticated = true;
    const shop = loadVideoUploadShop
      ? await loadVideoUploadShop(authResult.session.shop)
      : await loadVideoUploadShopFromDatabase(authResult.session.shop);
    const action = parseVideoLibraryAction(request);

    if (action.kind === "list") {
      if (request.method !== "GET") {
        return videoLibraryFailureResponse(405, "Video library listing only supports GET requests.");
      }

      const result = listVideos
        ? await listVideos(shop, new URL(request.url).searchParams)
        : await listVideosWithDatabase(shop, new URL(request.url).searchParams);

      return Response.json(result, {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    if (action.kind === "detail") {
      if (request.method !== "GET") {
        return videoLibraryFailureResponse(405, "Video detail only supports GET requests.");
      }

      const video = getVideo
        ? await getVideo(shop, action.videoId)
        : await getVideoWithDatabase(shop, action.videoId);

      return Response.json(
        {
          video,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (request.method !== "POST") {
      return videoLibraryFailureResponse(405, "Video archive only supports POST requests.");
    }

    const video = archiveVideo
      ? await archiveVideo(shop, action.videoId)
      : await archiveVideoWithDatabase(shop, action.videoId);

    return Response.json(
      {
        video,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    if (error instanceof VideoLibraryExpectedError) {
      logVideoLibraryError(error);
      return videoLibraryFailureResponse(error.status, error.clientMessage);
    }

    const status = authenticated ? 500 : 410;

    if (authenticated) {
      logVideoLibraryError(error);
    }

    return videoLibraryFailureResponse(status >= 400 && status < 500 ? status : 500);
  }
}

type VideoLibraryAction =
  | { kind: "list" }
  | { kind: "detail"; videoId: string }
  | { kind: "archive"; videoId: string };

function parseVideoLibraryAction(request: Request): VideoLibraryAction {
  const pathname = new URL(request.url).pathname.replace(/^\/api\/admin-videos/, "/api/admin/videos");

  if (pathname === "/api/admin/videos") {
    return { kind: "list" };
  }

  const match = pathname.match(/^\/api\/admin\/videos\/([^/]+)(?:\/(archive|restore))?$/);

  if (!match?.[1]) {
    throw new VideoLibraryExpectedError("Video library route was not found", 404);
  }

  if (match[2] === "restore") {
    throw new VideoLibraryExpectedError("Video restore is not supported yet", 404);
  }

  return match[2] === "archive"
    ? { kind: "archive", videoId: decodeURIComponent(match[1]) }
    : { kind: "detail", videoId: decodeURIComponent(match[1]) };
}

async function listVideosWithDatabase(
  shop: VideoUploadShop,
  query: URLSearchParams,
): Promise<VideoLibraryListResponse> {
  const { getPrismaClient, VideoRepository } = await import("@shoppable-video/db");
  const videoRepository = new VideoRepository(getPrismaClient());

  return listVideoLibrary({
    shop,
    query: {
      first: query.get("first"),
      after: query.get("after"),
      status: query.get("status"),
      source: query.get("source"),
      q: query.get("q"),
    },
    videoRepository,
  });
}

async function getVideoWithDatabase(
  shop: VideoUploadShop,
  videoId: string,
): Promise<SafeVideoLibraryDto> {
  const { getPrismaClient, VideoRepository } = await import("@shoppable-video/db");
  const videoRepository = new VideoRepository(getPrismaClient());

  return getVideoLibraryDetail({
    shop,
    videoId,
    videoRepository,
  });
}

async function archiveVideoWithDatabase(
  shop: VideoUploadShop,
  videoId: string,
): Promise<SafeVideoLibraryDto> {
  const { getPrismaClient, VideoRepository } = await import("@shoppable-video/db");
  const videoRepository = new VideoRepository(getPrismaClient());

  return archiveVideoLibraryItem({
    shop,
    videoId,
    videoRepository,
  });
}

function logVideoLibraryError(error: unknown): void {
  const reason = error instanceof Error ? error.name : "UnknownVideoLibraryError";

  console.error("Failed to handle video library request", {
    operation: "videos.library",
    reason,
  });
}

function videoLibraryFailureResponse(
  status: number,
  message = "We could not load the video library. Reload the app from Shopify admin.",
): Response {
  return Response.json(
    {
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function handleVideoProductTagsRequest(
  request: Request,
  {
    authenticateAdmin,
    createVideoProductTag: createTag,
    deleteVideoProductTag: deleteTag,
    handleVideoProductTags,
    listVideoProductTags: listTags,
    loadVideoUploadShop,
  }: RuntimeDependencies,
): Promise<Response> {
  if (handleVideoProductTags) {
    return handleVideoProductTags(request);
  }

  if (!authenticateAdmin && !hasBearerAuthorization(request)) {
    return videoProductTagsFailureResponse(410);
  }

  let authenticated = false;

  try {
    const authResult = await authenticateDashboardRequest(request, authenticateAdmin);
    authenticated = true;
    const shop = loadVideoUploadShop
      ? await loadVideoUploadShop(authResult.session.shop)
      : await loadVideoUploadShopFromDatabase(authResult.session.shop);
    const action = parseVideoProductTagsAction(request);

    if (action.kind === "list") {
      if (request.method !== "GET") {
        return videoProductTagsFailureResponse(
          405,
          "Product tag listing only supports GET requests.",
        );
      }

      const result = listTags
        ? await listTags(shop, action.videoId)
        : await listVideoProductTagsWithDatabase(shop, action.videoId);

      return Response.json(result, {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    if (action.kind === "create") {
      if (request.method !== "POST") {
        return videoProductTagsFailureResponse(
          405,
          "Product tag creation only supports POST requests.",
        );
      }

      const body = await parseVideoProductTagJsonRequestBody(request);
      const tag = createTag
        ? await createTag(shop, action.videoId, body)
        : await createVideoProductTagWithDatabase(shop, action.videoId, body);

      return Response.json(
        {
          tag,
        },
        {
          status: 201,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (request.method !== "DELETE") {
      return videoProductTagsFailureResponse(
        405,
        "Product tag removal only supports DELETE requests.",
      );
    }

    const result = deleteTag
      ? await deleteTag(shop, action.videoId, action.tagId)
      : await deleteVideoProductTagWithDatabase(shop, action.videoId, action.tagId);

    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    if (error instanceof VideoProductTagExpectedError) {
      logVideoProductTagsError(error);
      return videoProductTagsFailureResponse(error.status, error.clientMessage);
    }

    const status = authenticated ? 500 : 410;

    if (authenticated) {
      logVideoProductTagsError(error);
    }

    return videoProductTagsFailureResponse(status >= 400 && status < 500 ? status : 500);
  }
}

type VideoProductTagsAction =
  | { kind: "list"; videoId: string }
  | { kind: "create"; videoId: string }
  | { kind: "delete"; videoId: string; tagId: string };

function parseVideoProductTagsAction(request: Request): VideoProductTagsAction {
  const pathname = new URL(request.url).pathname.replace(/^\/api\/admin-videos/, "/api/admin/videos");
  const match = pathname.match(/^\/api\/admin\/videos\/([^/]+)\/product-tags(?:\/([^/]+))?$/);

  if (!match?.[1]) {
    throw new VideoProductTagExpectedError("Product tag route was not found", 404);
  }

  const videoId = decodeURIComponent(match[1]);

  if (match[2]) {
    return {
      kind: "delete",
      videoId,
      tagId: decodeURIComponent(match[2]),
    };
  }

  return request.method === "POST" ? { kind: "create", videoId } : { kind: "list", videoId };
}

async function parseVideoProductTagJsonRequestBody(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new VideoProductTagExpectedError("Request body must be valid JSON", 400);
  }
}

async function listVideoProductTagsWithDatabase(
  shop: VideoUploadShop,
  videoId: string,
): Promise<VideoProductTagsListResponse> {
  const { getPrismaClient, VideoProductTagRepository, VideoRepository } = await import("@shoppable-video/db");
  const prismaClient = getPrismaClient();

  return listVideoProductTags({
    shop,
    videoId,
    videoRepository: new VideoRepository(prismaClient),
    tagRepository: new VideoProductTagRepository(prismaClient),
  });
}

async function createVideoProductTagWithDatabase(
  shop: VideoUploadShop,
  videoId: string,
  input: unknown,
): Promise<SafeVideoProductTagDto> {
  const { getPrismaClient, VideoProductTagRepository, VideoRepository } = await import("@shoppable-video/db");
  const prismaClient = getPrismaClient();

  return createVideoProductTag({
    shop,
    videoId,
    input,
    videoRepository: new VideoRepository(prismaClient),
    tagRepository: new VideoProductTagRepository(prismaClient),
  });
}

async function deleteVideoProductTagWithDatabase(
  shop: VideoUploadShop,
  videoId: string,
  tagId: string,
): Promise<{ deleted: true }> {
  const { getPrismaClient, VideoProductTagRepository, VideoRepository } = await import("@shoppable-video/db");
  const prismaClient = getPrismaClient();

  return deleteVideoProductTag({
    shop,
    videoId,
    tagId,
    videoRepository: new VideoRepository(prismaClient),
    tagRepository: new VideoProductTagRepository(prismaClient),
  });
}

function logVideoProductTagsError(error: unknown): void {
  const reason = error instanceof Error ? error.name : "UnknownVideoProductTagError";

  console.error("Failed to handle video product tag request", {
    operation: "videos.productTags",
    reason,
  });
}

function videoProductTagsFailureResponse(
  status: number,
  message = "We could not update video product tags. Reload the app from Shopify admin.",
): Response {
  return Response.json(
    {
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function handleVideoUploadRequest(
  request: Request,
  {
    authenticateAdmin,
    handleVideoUpload,
    loadVideoUploadShop,
    createUploadIntent,
    writeUploadObject,
    completeUpload,
    dispatchVideoProcessingJob,
  }: RuntimeDependencies,
): Promise<Response> {
  if (handleVideoUpload) {
    return handleVideoUpload(request);
  }

  if (!authenticateAdmin && !hasBearerAuthorization(request)) {
    return videoUploadFailureResponse(410);
  }

  let authenticated = false;

  try {
    const authResult = await authenticateDashboardRequest(request, authenticateAdmin);
    authenticated = true;
    const shop = loadVideoUploadShop
      ? await loadVideoUploadShop(authResult.session.shop)
      : await loadVideoUploadShopFromDatabase(authResult.session.shop);
    const action = parseVideoUploadAction(request);

    if (action.kind === "upload-intent") {
      if (request.method !== "POST") {
        return videoUploadFailureResponse(405, "Upload intent only supports POST requests.");
      }

      const body = await parseJsonRequestBody(request);
      const result = createUploadIntent
        ? await createUploadIntent(shop, body)
        : await createUploadIntentWithDatabase(shop, body);

      return Response.json(result, {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    if (action.kind === "upload") {
      if (request.method !== "PUT" && request.method !== "POST") {
        return videoUploadFailureResponse(405, "Video upload only supports PUT or POST requests.");
      }

      const video = writeUploadObject
        ? await writeUploadObject(shop, action.videoId, request)
        : await writeUploadObjectWithDatabase(shop, action.videoId, request);

      return Response.json(
        {
          video,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (request.method !== "POST") {
      return videoUploadFailureResponse(405, "Upload completion only supports POST requests.");
    }

    const video = completeUpload
      ? await completeUpload(shop, action.videoId)
      : await completeUploadWithDatabase(
          shop,
          action.videoId,
          createStorageProviderFromEnv(),
          dispatchVideoProcessingJob
            ? {
                dispatchVideoProcessingJob({ videoId }) {
                  return dispatchVideoProcessingJob(shop, videoId);
                },
              }
            : createVideoProcessingDispatcherFromEnv(),
        );

    return Response.json(
      {
        video,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    if (error instanceof VideoUploadExpectedError) {
      logVideoUploadError(error);
      return videoUploadFailureResponse(error.status, error.clientMessage);
    }

    const status = authenticated ? 500 : 410;

    if (authenticated) {
      logVideoUploadError(error);
    }

    return videoUploadFailureResponse(status >= 400 && status < 500 ? status : 500);
  }
}

type VideoUploadAction =
  | { kind: "upload-intent" }
  | { kind: "upload"; videoId: string }
  | { kind: "complete-upload"; videoId: string };

function parseVideoUploadAction(request: Request): VideoUploadAction {
  const pathname = new URL(request.url).pathname.replace(/^\/api\/admin-videos/, "/api/admin/videos");

  if (pathname === "/api/admin/videos/upload-intent") {
    return { kind: "upload-intent" };
  }

  const match = pathname.match(/^\/api\/admin\/videos\/([^/]+)\/(upload|complete-upload)$/);

  if (!match?.[1] || !match[2]) {
    throw new VideoUploadExpectedError("Video upload route was not found", 404);
  }

  return {
    kind: match[2] === "upload" ? "upload" : "complete-upload",
    videoId: decodeURIComponent(match[1]),
  };
}

async function parseJsonRequestBody(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new VideoUploadExpectedError("Request body must be valid JSON", 400);
  }
}

async function loadVideoUploadShopFromDatabase(shopDomain: string): Promise<VideoUploadShop> {
  const { getPrismaClient, ShopRepository } = await import("@shoppable-video/db");
  const shopRepository = new ShopRepository(getPrismaClient());
  const shop = await shopRepository.ensureInstalled(shopDomain);

  return {
    id: shop.id,
    shopDomain: shop.shopDomain,
  };
}

async function createUploadIntentWithDatabase(
  shop: VideoUploadShop,
  input: unknown,
): Promise<UploadIntentResult> {
  const { getPrismaClient, VideoRepository } = await import("@shoppable-video/db");
  const videoRepository = new VideoRepository(getPrismaClient());

  return createManualUploadIntent({
    request: input && typeof input === "object" ? input : {},
    shop,
    videoRepository,
  });
}

async function writeUploadObjectWithDatabase(
  shop: VideoUploadShop,
  videoId: string,
  request: Request,
): Promise<SafeVideoDto> {
  const { getPrismaClient, VideoRepository } = await import("@shoppable-video/db");
  const videoRepository = new VideoRepository(getPrismaClient());
  const video = await videoRepository.findOwnedVideo(shop.id, videoId);

  if (!video) {
    throw new VideoUploadExpectedError("Video was not found", 404);
  }

  return writeManualUploadObject({
    video,
    contentType: request.headers.get("Content-Type"),
    body: new Uint8Array(await request.arrayBuffer()),
    storageProvider: createStorageProviderFromEnv(),
  });
}

async function completeUploadWithDatabase(
  shop: VideoUploadShop,
  videoId: string,
  storageProvider: StorageProvider = createStorageProviderFromEnv(),
  processingDispatcher: VideoProcessingDispatcher = createVideoProcessingDispatcherFromEnv(),
): Promise<SafeVideoDto> {
  const { getPrismaClient, VideoRepository } = await import("@shoppable-video/db");
  const videoRepository = new VideoRepository(getPrismaClient());
  const video = await videoRepository.findOwnedVideo(shop.id, videoId);

  if (!video) {
    throw new VideoUploadExpectedError("Video was not found", 404);
  }

  return completeManualUpload({
    video,
    videoRepository,
    storageProvider,
    processingDispatcher,
  });
}

function createVideoProcessingDispatcherFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): VideoProcessingDispatcher {
  const queueProvider = (env.QUEUE_PROVIDER ?? "memory").trim().toLowerCase();

  if (queueProvider !== "memory") {
    throw new VideoUploadExpectedError("Unsupported video processing queue provider", 500);
  }

  return {
    async dispatchVideoProcessingJob({ videoId }) {
      const { getPrismaClient, VideoRepository } = await import("@shoppable-video/db");
      const { createLocalVideoStorageResolverFromEnv, processVideoJob } = await import(
        "@shoppable-video/video-worker"
      );
      const videoRepository = new VideoRepository(getPrismaClient());

      await processVideoJob(
        {
          videoId,
        },
        {
          videoRepository,
          storageResolver: createLocalVideoStorageResolverFromEnv(env),
        },
      );

      const processedVideo = await videoRepository.findById(videoId);

      if (!processedVideo) {
        throw new VideoUploadExpectedError("Video was not found", 404);
      }

      return toSafeVideoDto(processedVideo);
    },
  };
}

function logVideoUploadError(error: unknown): void {
  const reason = error instanceof Error ? error.name : "UnknownVideoUploadError";

  console.error("Failed to handle manual video upload", {
    operation: "videos.manualUpload",
    reason,
  });
}

function videoUploadFailureResponse(
  status: number,
  message = "We could not handle the video upload request. Reload the app from Shopify admin.",
): Response {
  return Response.json(
    {
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function authenticateDashboardRequest(
  request: Request,
  authenticateAdmin?: (request: Request) => Promise<AdminAuthResult>,
): Promise<AdminAuthResult> {
  try {
    return authenticateAdmin
      ? await authenticateAdmin(request)
      : await authenticateShopifyAdmin(request);
  } catch (error) {
    const tokenAuthResult = await authenticateDashboardBearerToken(request);

    if (tokenAuthResult) {
      return tokenAuthResult;
    }

    throw error;
  }
}

async function loadDashboardShopFromDatabase(shopDomain: string): Promise<DashboardShopRecord> {
  const { getPrismaClient, ShopRepository } = await import("@shoppable-video/db");
  const shopRepository = new ShopRepository(getPrismaClient());

  return shopRepository.ensureInstalled(shopDomain);
}

export function createDashboardShopContextDiagnostic(error: unknown) {
  const diagnosticError = toDashboardDiagnosticError(error);

  return {
    operation: "dashboard.ensureShopContext",
    reason: diagnosticError.name,
    code: typeof diagnosticError.code === "string" ? diagnosticError.code : undefined,
    clientVersion:
      typeof diagnosticError.clientVersion === "string" ? diagnosticError.clientVersion : undefined,
    message: sanitizeDiagnosticMessage(diagnosticError.message),
    meta: sanitizeDiagnosticMeta(diagnosticError.meta),
  };
}

function logDashboardShopContextError(error: unknown): void {
  console.error(
    "Failed to load dashboard shop context",
    createDashboardShopContextDiagnostic(error),
  );
}

function toDashboardDiagnosticError(error: unknown): DashboardDiagnosticError {
  if (error instanceof Error) {
    return error;
  }

  return new Error("Unknown dashboard shop context error");
}

function sanitizeDiagnosticMeta(meta: unknown): Record<string, SafeDiagnosticValue> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return {};
  }

  const sanitizedMeta: Record<string, SafeDiagnosticValue> = {};
  const metaRecord = meta as Record<string, unknown>;

  for (const [key, value] of Object.entries(metaRecord)) {
    if (isSensitiveDiagnosticKey(key)) {
      continue;
    }

    if (isSafeDiagnosticValue(value)) {
      sanitizedMeta[key] = sanitizeDiagnosticValue(value);
    }
  }

  return sanitizedMeta;
}

function sanitizeDiagnosticMessage(message: string): string {
  const sanitizedMessage = sanitizeDiagnosticValue(message);

  return typeof sanitizedMessage === "string" ? sanitizedMessage.slice(0, 800) : "";
}

function sanitizeDiagnosticValue(value: SafeDiagnosticValue): SafeDiagnosticValue {
  if (typeof value !== "string") {
    return value;
  }

  if (containsSensitiveDiagnosticValue(value)) {
    return "[redacted]";
  }

  return value;
}

function isSafeDiagnosticValue(value: unknown): value is SafeDiagnosticValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  );
}

function isSensitiveDiagnosticKey(key: string): boolean {
  return /authorization|token|secret|password|database|connection|url|access/i.test(key);
}

function containsSensitiveDiagnosticValue(value: string): boolean {
  return (
    /bearer\s+/i.test(value) ||
    /postgres(?:ql)?:\/\//i.test(value) ||
    /shopify_api_secret/i.test(value) ||
    /database_url/i.test(value) ||
    /access[_-]?token/i.test(value)
  );
}

async function handleWebhookRequest(
  request: Request,
  { authenticateWebhook, handleWebhook }: RuntimeDependencies,
): Promise<Response> {
  if (handleWebhook) {
    return handleWebhook(request);
  }

  try {
    const rawBody = await request.clone().text();
    const webhook = authenticateWebhook
      ? await authenticateWebhook(request)
      : await authenticateShopifyWebhook(request);
    const { getPrismaClient, ShopRepository, WebhookDeliveryRepository } =
      await import("@shoppable-video/db");
    const { isAppUninstalledTopic, normalizeShopifyWebhookTopic } =
      await import("@shoppable-video/shopify");
    const prisma = getPrismaClient();
    const shopRepository = new ShopRepository(prisma);
    const webhookDeliveryRepository = new WebhookDeliveryRepository(prisma);
    const topic = normalizeShopifyWebhookTopic(webhook.topic);
    const shop = await shopRepository.findByDomain(webhook.shop);
    const deliveryId = webhook.webhookId || webhook.eventId;

    if (!deliveryId) {
      throw new Error("Shopify webhook delivery ID is missing");
    }

    const deliveryResult = await webhookDeliveryRepository.recordDelivery({
      shopId: shop?.id ?? null,
      topic,
      deliveryId,
      payloadHash: createHash("sha256").update(rawBody, "utf8").digest("hex"),
    });

    let handled = false;
    if (!deliveryResult.isDuplicate && isAppUninstalledTopic(topic)) {
      await shopRepository.markUninstalled(webhook.shop);
      handled = true;
    } else if (deliveryResult.isDuplicate) {
      handled = true;
    }

    return Response.json({
      ok: true,
      duplicate: deliveryResult.isDuplicate,
      handled,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return Response.json(serializeError(error), { status: 500 });
  }
}

async function handleAuthRequest(
  request: Request,
  { authenticateAdmin }: RuntimeDependencies,
): Promise<Response> {
  try {
    if (authenticateAdmin) {
      await authenticateAdmin(toShopifyAuthRequest(request));
    } else {
      await authenticateShopifyAdmin(toShopifyAuthRequest(request));
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    throw error;
  }
}

async function authenticateShopifyAdmin(request: Request): Promise<AdminAuthResult> {
  const shopify = await getShopifyServer();

  return shopify.authenticate.admin(request);
}

async function authenticateShopifyWebhook(request: Request): Promise<WebhookContext> {
  const shopify = await getShopifyServer();

  return shopify.authenticate.webhook(request);
}

async function getShopifyServer() {
  const { AppDistribution, shopifyApp } = await import("@shopify/shopify-app-react-router/server");
  const { getPrismaClient, PrismaShopifySessionStorage, ShopRepository } =
    await import("@shoppable-video/db");
  const { parseShopifyScopes, toShopifyApiVersion } = await import("@shoppable-video/shopify");
  const env = parseEnv(process.env);
  const prisma = getPrismaClient();
  const shopRepository = new ShopRepository(prisma);

  return shopifyApp({
    apiKey: env.SHOPIFY_API_KEY,
    apiSecretKey: env.SHOPIFY_API_SECRET,
    apiVersion: toShopifyApiVersion(env.SHOPIFY_API_VERSION),
    appUrl: env.SHOPIFY_APP_URL,
    scopes: parseShopifyScopes(env.SHOPIFY_SCOPES),
    sessionStorage: new PrismaShopifySessionStorage(prisma),
    distribution: AppDistribution.AppStore,
    authPathPrefix: "/auth",
    useOnlineTokens: false,
    hooks: {
      afterAuth: async ({ session }: { session: AdminSession }) => {
        await shopRepository.ensureInstalled(session.shop);
      },
    },
  });
}

function parseEnv(env: NodeJS.ProcessEnv) {
  return {
    SHOPIFY_API_KEY: requireEnv(env, "SHOPIFY_API_KEY"),
    SHOPIFY_API_SECRET: requireEnv(env, "SHOPIFY_API_SECRET"),
    SHOPIFY_APP_URL: requireEnv(env, "SHOPIFY_APP_URL"),
    SHOPIFY_SCOPES: requireEnv(env, "SHOPIFY_SCOPES"),
    SHOPIFY_API_VERSION: requireEnv(env, "SHOPIFY_API_VERSION") as
      | "2024-10"
      | "2025-01"
      | "2025-04"
      | "2025-07"
      | "2025-10"
      | "2026-01"
      | "2026-04"
      | "unstable",
  };
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      },
    };
  }

  return {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unknown error",
    },
  };
}

function hasBearerAuthorization(request: Request): boolean {
  const authorization = request.headers.get("Authorization");

  return (
    authorization?.toLowerCase().startsWith("bearer ") === true &&
    authorization.slice(7).trim().length > 0
  );
}

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("Authorization");

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return undefined;
  }

  const token = authorization.slice(7).trim();

  return token.length > 0 ? token : undefined;
}

async function authenticateDashboardBearerToken(
  request: Request,
): Promise<AdminAuthResult | undefined> {
  const token = getBearerToken(request);

  if (!token) {
    return undefined;
  }

  try {
    const { shopifyApi } = await import("@shopify/shopify-api");
    const { parseShopifyScopes, toShopifyApiVersion } = await import("@shoppable-video/shopify");
    const env = parseEnv(process.env);
    const appUrl = new URL(env.SHOPIFY_APP_URL);
    const api = shopifyApi({
      apiKey: env.SHOPIFY_API_KEY,
      apiSecretKey: env.SHOPIFY_API_SECRET,
      apiVersion: toShopifyApiVersion(env.SHOPIFY_API_VERSION),
      scopes: parseShopifyScopes(env.SHOPIFY_SCOPES),
      hostName: appUrl.hostname,
      hostScheme: appUrl.protocol === "http:" ? "http" : "https",
      isEmbeddedApp: true,
    });
    const payload = await api.session.decodeSessionToken(token);
    const shopDomain = new URL(payload.dest).hostname;

    return {
      session: {
        shop: shopDomain,
      },
    };
  } catch {
    return undefined;
  }
}

function dashboardAuthFailureResponse(status: number): Response {
  return Response.json(
    {
      message:
        "We could not load the authenticated shop context. Reload the app from Shopify admin.",
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function toShopifyAuthRequest(request: Request): Request {
  const url = new URL(request.url);

  if (url.pathname === "/api/auth") {
    url.pathname = "/auth";
  } else if (url.pathname.startsWith("/api/auth/")) {
    url.pathname = url.pathname.replace(/^\/api\/auth/, "/auth");
  }

  return new Request(url, request);
}

async function toFetchRequest(nodeRequest: IncomingMessage): Promise<Request> {
  const method = nodeRequest.method ?? "GET";
  const headers = toFetchHeaders(nodeRequest.headers);
  const host = headers.get("host") ?? "localhost";
  const protocol = headers.get("x-forwarded-proto") ?? "https";
  const url = new URL(nodeRequest.url ?? "/", `${protocol}://${host}`);
  const body =
    method === "GET" || method === "HEAD" ? undefined : await readRequestBody(nodeRequest);

  return new Request(url, {
    method,
    headers,
    body,
  });
}

function toFetchHeaders(nodeHeaders: IncomingHttpHeaders): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  return headers;
}

async function readRequestBody(nodeRequest: IncomingMessage): Promise<Blob | undefined> {
  const chunks: Buffer[] = [];

  for await (const chunk of nodeRequest as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return new Blob([Buffer.concat(chunks)]);
}

async function writeNodeResponse(nodeResponse: ServerResponse, response: Response): Promise<void> {
  nodeResponse.statusCode = response.status;
  response.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });

  if (!response.body) {
    nodeResponse.end();
    return;
  }

  const body = Buffer.from(await response.arrayBuffer());
  nodeResponse.end(body);
}
