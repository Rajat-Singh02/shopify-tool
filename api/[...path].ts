import { createHash } from "node:crypto";
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";

export const config = {
  api: {
    bodyParser: false,
  },
};

type VercelRuntimeRoute = "admin-dashboard" | "auth" | "health" | "webhook" | "not-found";

type AdminSession = {
  shop: string;
};

type AdminAuthResult = {
  session: AdminSession;
};

type DashboardShopRecord = {
  shopDomain: string;
  installedAt: Date;
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
  handleWebhook?: (request: Request) => Promise<Response>;
  loadDashboardShop?: (shopDomain: string) => Promise<DashboardShopRecord>;
};

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  await handleNodeServerRequest(request, response);
}

export function resolveVercelRuntimeRoute(pathname: string): VercelRuntimeRoute {
  if (pathname === "/api/admin/dashboard" || pathname === "/api/admin-dashboard") {
    return "admin-dashboard";
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

    return dashboardAuthFailureResponse(status >= 400 && status < 500 ? status : 500);
  }
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
  try {
    const { getPrismaClient, ShopRepository } = await import("@shoppable-video/db");
    const shopRepository = new ShopRepository(getPrismaClient());

    return await shopRepository.ensureInstalled(shopDomain);
  } catch (error) {
    console.error("Failed to load dashboard shop context", {
      reason: error instanceof Error ? error.name : "UnknownError",
    });

    throw error;
  }
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
