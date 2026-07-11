import { expect, type Page } from "@playwright/test";

/* Fill that survives React hydration. Storefront pages are static now (the
   (shop) layout no longer reads cookies), so the prerendered HTML is
   interactive-looking before React attaches — a fill that lands pre-hydration
   gets wiped when the controlled input hydrates to its empty state. Fill,
   give React a beat, and verify the value STUCK; retry until it does. Use it
   for the FIRST field touched on a page — after one sticky fill the page is
   proven hydrated and plain fills/clicks are safe. */
export async function hydratedFill(page: Page, selector: string, value: string) {
  await expect(async () => {
    await page.locator(selector).fill(value);
    await page.waitForTimeout(250);
    await expect(page.locator(selector)).toHaveValue(value, { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}
