import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";

import { getPrismaClient, ShopRepository, WebhookDeliveryRepository } from "@shoppable-video/db";

import { authenticate } from "../app/lib/shopify.server";
import { handleHealthRequest } from "../routes/health";
import { handleAdminDashboardContextRequest } from "../routes/app.server";
import { handleWebhookAction } from "../routes/webhooks";

export type VercelRuntimeRoute =
  | "admin-dashboard"
  | "auth"
  | "health"
  | "webhook"
  | "not-found";

export type VercelRuntimeDependencies = {
  authenticateAdmin?: (request: Request) => Promise<unknown>;
  handleAdminDashboard?: (request: Request) => Promise<Response>;
  handleHealth?: () => {
    status: number;
    body: string;
    headers: Record<string, string>;
  };
  handleWebhook?: (request: Request) => Promise<Response>;
};

export function resolveVercelRuntimeRoute(pathname: string): VercelRuntimeRoute {
  if (pathname === "/api/admin/dashboard") {
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
  {
    authenticateAdmin = (authRequest) => authenticate.admin(authRequest),
    handleAdminDashboard = (adminRequest) => {
      const prisma = getPrismaClient();

      return handleAdminDashboardContextRequest(adminRequest, {
        shopRepository: new ShopRepository(prisma),
      });
    },
    handleHealth = handleHealthRequest,
    handleWebhook = (webhookRequest) => {
      const prisma = getPrismaClient();

      return handleWebhookAction(webhookRequest, {
        shopRepository: new ShopRepository(prisma),
        webhookDeliveryRepository: new WebhookDeliveryRepository(prisma),
      });
    },
  }: VercelRuntimeDependencies = {},
): Promise<Response> {
  const route = resolveVercelRuntimeRoute(new URL(request.url).pathname);

  if (route === "admin-dashboard") {
    return handleAdminDashboard(request);
  }

  if (route === "webhook") {
    return handleWebhook(request);
  }

  if (route === "health") {
    const health = handleHealth();

    return new Response(health.body, {
      status: health.status,
      headers: health.headers,
    });
  }

  if (route === "auth") {
    try {
      await authenticateAdmin(toShopifyAuthRequest(request));

      return new Response(null, { status: 204 });
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }

      throw error;
    }
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
  const body = method === "GET" || method === "HEAD" ? undefined : await readRequestBody(nodeRequest);

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

async function writeNodeResponse(
  nodeResponse: ServerResponse,
  response: Response,
): Promise<void> {
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
