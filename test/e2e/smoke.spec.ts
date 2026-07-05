import { test, expect } from "@playwright/test";

test("storefront home page renders", async ({ page }) => {
  // domcontentloaded on purpose: the home page eagerly loads ~60 gallery and
  // product images from Supabase Storage, so the full `load` event can take
  // arbitrarily long on a cold cache — the check here is that the app itself
  // server-renders, not the CDN's throughput.
  const res = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(res?.status() ?? 200).toBeLessThan(400);
  // The store header is a fixed element on every storefront page (splash is
  // skipped under automation — see src/app/loading-wrapper.tsx).
  await expect(page.locator("header").first()).toBeVisible();
});
