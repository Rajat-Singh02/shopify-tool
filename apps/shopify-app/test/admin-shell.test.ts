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
    expect(fetcher).toHaveBeenCalledWith(ADMIN_DASHBOARD_CONTEXT_PATH, {
      headers: {
        Accept: "application/json",
      },
    });
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
