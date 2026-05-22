import { expect, test } from "@playwright/test";

test("admin app loads the authenticated shell surface", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Shoppable Video" })).toBeVisible();
  await expect(page.getByText("Shop context unavailable")).toBeVisible();
});
