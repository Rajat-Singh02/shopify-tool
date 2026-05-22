import { expect, test } from "@playwright/test";

test("admin app loads the empty dashboard", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Shoppable Video" })).toBeVisible();
  await expect(page.getByText("Manual upload only")).toBeVisible();
});
