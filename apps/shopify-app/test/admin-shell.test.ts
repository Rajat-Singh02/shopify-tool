import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_DASHBOARD_CONTEXT_PATH,
  ADMIN_SHELL_SAFE_ERROR_MESSAGE,
  fetchAdminDashboardContext,
} from "../services/admin-shell";

describe("fetchAdminDashboardContext", () => {
  it("loads authenticated dashboard context from the admin endpoint", async () => {
    const data = {
      shop: {
        domain: "test-shop.myshopify.com",
        installedAt: "2026-05-22T00:00:00.000Z",
      },
      overview: {
        activeScopeLabel: "Manual upload only",
      },
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    await expect(fetchAdminDashboardContext(fetcher)).resolves.toEqual(data);
    const requestInit = fetcher.mock.calls[0]?.[1];
    const headers = new Headers(requestInit?.headers);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe(ADMIN_DASHBOARD_CONTEXT_PATH);
    expect(requestInit?.headers).toBeInstanceOf(Headers);
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Authorization")).toBeNull();
  });

  it("attaches an App Bridge ID token when one is available", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          shop: {
            domain: "test-shop.myshopify.com",
            installedAt: "2026-05-22T00:00:00.000Z",
          },
          overview: {
            activeScopeLabel: "Manual upload only",
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    await fetchAdminDashboardContext(fetcher, () => Promise.resolve("shopify-id-token"));

    const requestInit = fetcher.mock.calls[0]?.[1];
    const headers = new Headers(requestInit?.headers);

    expect(headers.get("Authorization")).toBe("Bearer shopify-id-token");
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("falls back to a safe unauthenticated request when App Bridge token loading fails", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("auth required", {
        status: 410,
      }),
    );

    await expect(
      fetchAdminDashboardContext(fetcher, () => Promise.reject(new Error("not embedded"))),
    ).rejects.toThrow(ADMIN_SHELL_SAFE_ERROR_MESSAGE);
    const requestInit = fetcher.mock.calls[0]?.[1];
    const headers = new Headers(requestInit?.headers);

    expect(headers.get("Authorization")).toBeNull();
  });

  it("throws a safe error when the endpoint rejects the request", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("raw auth failure with token", {
        status: 401,
      }),
    );

    await expect(fetchAdminDashboardContext(fetcher)).rejects.toThrow(
      ADMIN_SHELL_SAFE_ERROR_MESSAGE,
    );
  });
});
