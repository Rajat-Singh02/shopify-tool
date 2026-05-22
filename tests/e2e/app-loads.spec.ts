import { expect, test } from "@playwright/test";

test("admin app renders the shell and backend-unavailable fallback", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Shoppable Video" })).toBeVisible();
  await expect(page.getByText("Shop context unavailable")).toBeVisible();
});

test("admin app renders authenticated shop data when the backend route responds", async ({
  page,
}) => {
  await page.route("**/api/admin/dashboard", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        shop: {
          domain: "test-shop.myshopify.com",
          installedAt: "2026-05-22T00:00:00.000Z",
        },
        overview: {
          activeScopeLabel: "Manual upload only",
        },
      }),
    });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Shoppable Video" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connected shop" })).toBeVisible();
  await expect(page.getByText("test-shop.myshopify.com")).toBeVisible();
  await expect(page.getByText("Manual upload only")).toBeVisible();
});
