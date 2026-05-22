import { describe, expect, it } from "vitest";

import { ActiveVideoSourceSchema, ShopDomainSchema, VideoSourceSchema } from "./index";

describe("shared schemas", () => {
  it("keeps future video sources documented but inactive for v1", () => {
    expect(VideoSourceSchema.options).toEqual([
      "MANUAL_UPLOAD",
      "FUTURE_INSTAGRAM",
      "FUTURE_TIKTOK",
    ]);
    expect(ActiveVideoSourceSchema.parse("MANUAL_UPLOAD")).toBe("MANUAL_UPLOAD");
    expect(() => ActiveVideoSourceSchema.parse("FUTURE_INSTAGRAM")).toThrow();
  });

  it("validates Shopify shop domains", () => {
    expect(ShopDomainSchema.parse("Demo-Shop.myshopify.com")).toBe("demo-shop.myshopify.com");
    expect(() => ShopDomainSchema.parse("example.com")).toThrow();
  });
});
