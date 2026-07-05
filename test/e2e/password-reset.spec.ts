import crypto from "node:crypto";
import { test, expect } from "../fixtures/auth";
import { testDb, uniquePhone, uniqueEmail, closeTestDb } from "../fixtures/db";

/*
 * Customer forgot-password flow. The email itself can't be read by the suite,
 * so the reset LINK is minted here with the same HMAC scheme the app uses
 * (src/lib/customerAuth.ts) against a throwaway AutoTest customer — this
 * exercises the /account/reset page and the resetPassword action end to end.
 */

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "test-secret")
    .update(payload)
    .digest("base64url");
}

function mintResetToken(cid: string, passwordHash: string, expMs = Date.now() + 30 * 60 * 1000): string {
  const fp = crypto.createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);
  const body = JSON.stringify({ p: "pwreset", cid, fp, exp: expMs });
  const b64 = Buffer.from(body).toString("base64url");
  return `${b64}.${sign(b64)}`;
}

const email = uniqueEmail();
const oldPassword = "OldPass#123";
const newPassword = "NewPass#456";
let customerId: string;
let oldHash: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const bcrypt = require("bcryptjs") as typeof import("bcryptjs");
  oldHash = await bcrypt.hash(oldPassword, 10);
  customerId = crypto.randomUUID();
  await testDb().query(
    `INSERT INTO customers (id, name, phone, email, passwordhash) VALUES ($1, $2, $3, $4, $5)`,
    [customerId, `AutoTest Reset ${Date.now() % 1e6}`, uniquePhone(), email, oldHash]
  );
});

test.afterAll(async () => {
  await testDb().query(`DELETE FROM customers WHERE id = $1`, [customerId]);
  await closeTestDb();
});

test("forgot page always reports success (no account enumeration)", async ({ page }) => {
  await page.goto("/account/forgot", { waitUntil: "domcontentloaded" });
  await page.locator("#forgot-email").fill(`nobody-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();
});

test("a tampered or expired reset token is rejected", async ({ page }) => {
  const expired = mintResetToken(customerId, oldHash, Date.now() - 1000);
  await page.goto(`/account/reset?token=${encodeURIComponent(expired)}`, { waitUntil: "domcontentloaded" });
  await page.locator("#reset-password").fill(newPassword);
  await page.locator("#reset-confirm").fill(newPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText(/invalid or has expired/).first()).toBeVisible();
});

test("a valid reset link sets the new password and signs the customer in", async ({ page }) => {
  const token = mintResetToken(customerId, oldHash);
  await page.goto(`/account/reset?token=${encodeURIComponent(token)}`, { waitUntil: "domcontentloaded" });
  await page.locator("#reset-password").fill(newPassword);
  await page.locator("#reset-confirm").fill(newPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await page.waitForURL(/\/account/, { timeout: 30_000 });

  // The same link must not work twice (hash fingerprint changed)
  await page.goto(`/account/reset?token=${encodeURIComponent(token)}`, { waitUntil: "domcontentloaded" });
  await page.locator("#reset-password").fill("Another#789");
  await page.locator("#reset-confirm").fill("Another#789");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText(/invalid or has expired/).first()).toBeVisible();
});

test("login works with the new password and rejects the old one", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto((baseURL || "") + "/account/login", { waitUntil: "domcontentloaded" });
  await page.locator("#login-identifier").fill(email);
  await page.locator("#login-password").fill(oldPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid credentials.").first()).toBeVisible();

  await page.locator("#login-password").fill(newPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Welcome back!").first()).toBeVisible();
  await context.close();
});
