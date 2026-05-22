import { describe, expect, it } from "vitest";

import { assertShopScope, TenantScopeError } from "./index";

describe("repository scope helpers", () => {
  it("requires a shop id for tenant-scoped mutations", () => {
    expect(assertShopScope({ shopId: "shop_1" })).toBe("shop_1");
    expect(() => assertShopScope({ shopId: "" })).toThrow(TenantScopeError);
  });
});
