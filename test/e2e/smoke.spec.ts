import { test, expect } from "@playwright/test";

test("storefront home page renders", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status() ?? 200).toBeLessThan(400);
  // The store header is a fixed element on every storefront page (splash is
  // skipped under automation — see src/app/loading-wrapper.tsx).
  await expect(page.locator("header").first()).toBeVisible();
});
