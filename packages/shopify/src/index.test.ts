import { ApiVersion } from "@shopify/shopify-app-react-router/server";
import { describe, expect, it } from "vitest";

import { parseShopifyScopes, toShopifyApiVersion } from "./index";

describe("Shopify config helpers", () => {
  it("maps configured API versions to Shopify package versions", () => {
    expect(toShopifyApiVersion("2026-04")).toBe(ApiVersion.April26);
  });

  it("parses comma-separated scopes", () => {
    expect(parseShopifyScopes("read_products, write_files,,")).toEqual([
      "read_products",
      "write_files",
    ]);
  });
});
