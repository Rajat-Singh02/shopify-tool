import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import {
  handleVercelRuntimeRequest,
  resolveVercelRuntimeRoute,
} from "./[...path]";

describe("Vercel runtime route surface", () => {
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

  it("routes webhook requests to the server handler and preserves rejection responses", async () => {
    const handleWebhook = vi.fn().mockResolvedValue(new Response(undefined, { status: 401 }));
    const response = await handleVercelRuntimeRequest(
      new Request("https://app.example.test/api/webhooks", {
        method: "POST",
        body: "{\"shop_domain\":\"test-shop.myshopify.com\"}",
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
});
