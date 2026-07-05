import { test, expect, mintAdminCookie } from "../fixtures/auth";

/*
 * Server-side admin protection (middleware + requireAdmin guards).
 * Before this existed, admin auth was localStorage-only: every admin page's
 * data and all ~180 admin server actions were reachable by anyone.
 */

const ADMIN_PAGES = ["/dashboard", "/web-orders", "/orders", "/customers", "/finance", "/users"];

test("admin pages redirect anonymous visitors to /login", async ({ page }) => {
  for (const path of ADMIN_PAGES) {
    const res = await page.goto(path);
    await page.waitForURL(/\/login/);
    expect(res?.status(), `${path} should not 500`).toBeLessThan(500);
    expect(page.url()).toContain("/login");
  }
});

test("admin POSTs (server actions) without a session get 401", async ({ request }) => {
  const res = await request.post("/web-orders", {
    headers: { "content-type": "text/plain;charset=UTF-8", "next-action": "0".repeat(40) },
    data: "[]",
  });
  expect(res.status()).toBe(401);
});

test("a tampered admin cookie is rejected", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const host = new URL(baseURL || "http://localhost:3100").hostname;
  // Valid shape but signed payload altered afterwards (role escalation attempt)
  const good = mintAdminCookie({ Id: "x", Username: "hacker", Role: "Staff" });
  const [body] = good.split(".");
  const forged = Buffer.from(
    Buffer.from(body, "base64url").toString().replace("Staff", "Admin")
  ).toString("base64url");
  await context.addCookies([
    { name: "ef_admin", value: `${forged}.${good.split(".")[1]}`, domain: host, path: "/" },
  ]);
  const page = await context.newPage();
  await page.goto("/web-orders");
  await page.waitForURL(/\/login/);
  await context.close();
});

test("staff session cannot open Admin-only pages", async ({ playwright, baseURL }) => {
  // Raw HTTP (no JS) so the middleware's redirect is observable directly.
  const staff = mintAdminCookie({ Id: "BBBBBBBB-0000-0000-0000-000000000002", Username: "staff", Role: "Staff" });
  const ctx = await playwright.request.newContext({
    baseURL: baseURL || "http://localhost:3100",
    extraHTTPHeaders: { cookie: `ef_admin=${staff}` },
  });
  const res = await ctx.get("/finance", { maxRedirects: 0 });
  expect(res.status()).toBe(307); // middleware role gate
  expect(res.headers()["location"]).toContain("/dashboard");
  // …but a non-Admin-only page is allowed for staff
  const ok = await ctx.get("/dashboard", { maxRedirects: 0 });
  expect(ok.status()).toBe(200);
  await ctx.dispose();
});

test("valid admin session still reaches the admin panel", async ({ asAdmin }) => {
  const page = await asAdmin.newPage();
  const res = await page.goto("/web-orders");
  expect(res?.status()).toBe(200);
  await expect(page.getByText("Website Orders").first()).toBeVisible();
});
