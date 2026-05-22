import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDashboardShopContextDiagnostic,
  handleVercelRuntimeRequest,
  resolveVercelRuntimeRoute,
} from "./[...path]";

describe("Vercel runtime route surface", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("imports the serverless entry without app-source module resolution failures", () => {
    expect(typeof handleVercelRuntimeRequest).toBe("function");
    expect(typeof resolveVercelRuntimeRoute).toBe("function");
  });

  it.each([
    ["/api/admin/dashboard", "admin-dashboard"],
    ["/api/admin-dashboard", "admin-dashboard"],
    ["/api/webhooks", "webhook"],
    ["/webhooks", "webhook"],
    ["/api/auth/callback", "auth"],
    ["/auth/callback", "auth"],
    ["/api/health", "health"],
    ["/health", "health"],
  ] as const)("routes %s to %s", (pathname, route) => {
    expect(resolveVercelRuntimeRoute(pathname)).toBe(route);
  });

  it("serves health checks without loading the app runtime", async () => {
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/health", {
        method: "HEAD",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("serves safe authenticated admin dashboard data through the runtime adapter", async () => {
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/dashboard"),
      {
        handleAdminDashboard() {
          return Promise.resolve(
            Response.json({
              shop: {
                domain: "test-shop.myshopify.com",
                installedAt: "2026-05-22T00:00:00.000Z",
              },
              overview: {
                activeScopeLabel: "Manual upload only",
              },
            }),
          );
        },
      },
    );

    const body = (await response.json()) as {
      shop: {
        domain: string;
      };
    };
    const serializedBody = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.shop.domain).toBe("test-shop.myshopify.com");
    expect(serializedBody).not.toContain("accessToken");
    expect(serializedBody).not.toContain("session");
    expect(serializedBody).not.toContain("SHOPIFY_API_SECRET");
  });

  it("returns a safe unauthenticated dashboard response when no bearer token is present", async () => {
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/dashboard"),
    );

    const body = (await response.json()) as {
      message: string;
    };

    expect(response.status).toBe(410);
    expect(body.message).toBe(
      "We could not load the authenticated shop context. Reload the app from Shopify admin.",
    );
  });

  it("returns a safe dashboard response when Shopify token authentication fails", async () => {
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/dashboard", {
        headers: {
          Authorization: "Bearer invalid-token",
        },
      }),
      {
        authenticateAdmin() {
          throw new Error("raw token validation failure");
        },
      },
    );

    const serializedBody = JSON.stringify(await response.json());

    expect(response.status).toBe(410);
    expect(serializedBody).not.toContain("raw token validation failure");
    expect(serializedBody).not.toContain("invalid-token");
  });

  it("resolves dashboard shop context from a valid App Bridge bearer token", async () => {
    vi.stubEnv("SHOPIFY_API_KEY", "test_api_key");
    vi.stubEnv("SHOPIFY_API_SECRET", "test_secret");
    vi.stubEnv("SHOPIFY_APP_URL", "https://app.example.test");
    vi.stubEnv("SHOPIFY_SCOPES", "read_products");
    vi.stubEnv("SHOPIFY_API_VERSION", "2026-04");
    const token = createTestSessionToken("test-shop.myshopify.com", "test_api_key", "test_secret");
    const loadDashboardShop = vi.fn().mockResolvedValue({
      shopDomain: "test-shop.myshopify.com",
      installedAt: new Date("2026-05-22T00:00:00.000Z"),
    });
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
      {
        authenticateAdmin() {
          throw new Error("offline session unavailable");
        },
        loadDashboardShop,
      },
    );
    const body = (await response.json()) as {
      shop: {
        domain: string;
      };
    };
    const serializedBody = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(loadDashboardShop).toHaveBeenCalledWith("test-shop.myshopify.com");
    expect(body.shop.domain).toBe("test-shop.myshopify.com");
    expect(serializedBody).not.toContain("accessToken");
    expect(serializedBody).not.toContain("session");
    expect(serializedBody).not.toContain("SHOPIFY_API_SECRET");
  });

  it("logs safe Prisma diagnostics when authenticated dashboard shop loading fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const prismaError = new Error("Invalid prisma.shop.upsert invocation with bearer abc") as Error & {
      code: string;
      clientVersion: string;
      meta: Record<string, unknown>;
    };
    prismaError.name = "PrismaClientKnownRequestError";
    prismaError.code = "P2022";
    prismaError.clientVersion = "7.8.0";
    prismaError.meta = {
      modelName: "Shop",
      column: "createdAt",
      accessToken: "secret-token",
      connectionString: "postgresql://secret",
    };

    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/admin/dashboard"),
      {
        authenticateAdmin() {
          return Promise.resolve({
            session: {
              shop: "test-shop.myshopify.com",
            },
          });
        },
        loadDashboardShop() {
          throw prismaError;
        },
      },
    );
    const loggedDiagnostic = consoleError.mock.calls[0]?.[1] as unknown;
    const serializedDiagnostic = JSON.stringify(loggedDiagnostic);

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to load dashboard shop context",
      expect.objectContaining({
        operation: "dashboard.ensureShopContext",
        reason: "PrismaClientKnownRequestError",
        code: "P2022",
        clientVersion: "7.8.0",
        message: "[redacted]",
        meta: {
          modelName: "Shop",
          column: "createdAt",
        },
      }),
    );
    expect(serializedDiagnostic).not.toContain("secret-token");
    expect(serializedDiagnostic).not.toContain("postgresql://");
    expect(serializedDiagnostic).not.toContain("Authorization");

    consoleError.mockRestore();
  });

  it("keeps dashboard Prisma diagnostics limited to safe primitive metadata", () => {
    const error = new Error("relation missing") as Error & {
      code: string;
      clientVersion: string;
      meta: Record<string, unknown>;
    };
    error.name = "PrismaClientKnownRequestError";
    error.code = "P2021";
    error.clientVersion = "7.8.0";
    error.meta = {
      modelName: "Shop",
      table: "public.Shop",
      token: "should-not-log",
      nested: {
        modelName: "Nested",
      },
    };

    const diagnostic = createDashboardShopContextDiagnostic(error);

    expect(diagnostic).toEqual({
      operation: "dashboard.ensureShopContext",
      reason: "PrismaClientKnownRequestError",
      code: "P2021",
      clientVersion: "7.8.0",
      message: "relation missing",
      meta: {
        modelName: "Shop",
        table: "public.Shop",
      },
    });
  });

  it("routes webhook requests to the server handler and preserves rejection responses", async () => {
    const handleWebhook = vi.fn().mockResolvedValue(new Response(undefined, { status: 401 }));
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/webhooks", {
        method: "POST",
        body: '{"shop_domain":"test-shop.myshopify.com"}',
      }),
      {
        handleWebhook,
      },
    );

    expect(response.status).toBe(401);
    expect(handleWebhook).toHaveBeenCalledOnce();
  });

  it("routes auth requests through the Shopify auth prefix", async () => {
    const authenticatedRequests: Request[] = [];
    const authenticateAdmin = vi.fn((request: Request) => {
      authenticatedRequests.push(request);

      return Promise.resolve({ session: { shop: "test-shop.myshopify.com" } });
    });
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/auth/callback?shop=test-shop.myshopify.com"),
      {
        authenticateAdmin,
      },
    );
    const authenticatedRequest = authenticatedRequests[0];

    expect(response.status).toBe(204);
    expect(authenticatedRequest).toBeInstanceOf(Request);
    if (!authenticatedRequest) {
      throw new Error("Expected auth runtime to call Shopify admin authentication");
    }
    expect(new URL(authenticatedRequest.url).pathname).toBe("/auth/callback");
  });

  it("keeps the admin dashboard path on the Vercel server route surface", async () => {
    const vercelConfig = JSON.parse(await readFile("vercel.json", "utf8")) as {
      rewrites?: Array<{
        source: string;
        destination: string;
      }>;
    };

    expect(vercelConfig.rewrites).toEqual(
      expect.arrayContaining([
        {
          source: "/api/admin/dashboard",
          destination: "/api/admin-dashboard",
        },
      ]),
    );
  });

  it("keeps the canonical Shopify auth callback on a nested Vercel API function", async () => {
    const authFunction = await readFile("api/auth/[...path].ts", "utf8");
    const vercelConfig = JSON.parse(await readFile("vercel.json", "utf8")) as {
      rewrites?: Array<{
        source: string;
        destination: string;
      }>;
    };

    expect(authFunction).toContain("../[...path].js");
    expect(vercelConfig.rewrites).toEqual(
      expect.arrayContaining([
        {
          source: "/auth/:path*",
          destination: "/api/auth/:path*",
        },
      ]),
    );
  });
});

function createTestSessionToken(shop: string, apiKey: string, apiSecretKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://${shop}/admin`,
    dest: `https://${shop}`,
    aud: apiKey,
    sub: "123456789",
    exp: now + 3600,
    nbf: now - 3600,
    iat: now - 3600,
    jti: "test-jti",
    sid: "test-sid",
  };
  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", apiSecretKey)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString("base64url");
}
