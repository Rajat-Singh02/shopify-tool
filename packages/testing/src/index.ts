export function createTestShop(overrides: Partial<{ id: string; shopDomain: string }> = {}) {
  return {
    id: "test_shop_1",
    shopDomain: "test-shop.myshopify.com",
    ...overrides,
  };
}
