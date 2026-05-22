import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Vercel runtime gate", () => {
  it("documents that current Vercel config is static-only until the server runtime PR", async () => {
    const vercelConfig = JSON.parse(await readFile("vercel.json", "utf8")) as {
      outputDirectory?: string;
      routes?: unknown;
      rewrites?: unknown;
      functions?: unknown;
    };
    const releaseDoc = await readFile("docs/releases/feature-1-auth-lifecycle.md", "utf8");

    expect(vercelConfig.outputDirectory).toBe("apps/shopify-app/dist/client");
    expect(vercelConfig.routes).toBeUndefined();
    expect(vercelConfig.rewrites).toBeUndefined();
    expect(vercelConfig.functions).toBeUndefined();
    expect(releaseDoc).toContain("Feature 1 is not production-ready on Vercel yet.");
    expect(releaseDoc).toContain("PR 1E: fix Vercel server runtime for Shopify auth/webhooks");
  });
});
