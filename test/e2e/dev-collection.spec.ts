import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/auth";
import { testDb, fetchOrder, fetchOrderItems, fetchVariantQty, uniquePhone, uniqueEmail, closeTestDb } from "../fixtures/db";
import { hydratedFill } from "../fixtures/ui";

/*
 * Real browser checkout for the Developer Everyday POD collection.
 * Buys one design (XL / Black), proves the order records that design and that
 * stock is drawn from the SHARED Oversized Tee blank, then admin-cancels the
 * order so the stock is restocked. afterAll guarantees cleanup.
 */

const runStamp = String(Date.now()).slice(-6);
const guest = {
  name: `AutoTest Dev ${runStamp}`,
  phone: uniquePhone(),
  email: uniqueEmail(),
  password: "AutoTest#123",
  address: "1 Dev Collection Rd, Colombo",
};

type Design = { slug: string; productName: string; variantId: string; teeVariantId: string; price: number; province: string; provinceFee: number };
let d: Design;
let orderId: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const db = testDb();
  // A Developer Everyday design's XL/Black variant + the Oversized Tee's XL/Black (the shared blank).
  const r = await db.query(`
    SELECT p.name AS "productName", p.slug, v.id AS "variantId", v.sellingprice AS price,
           (SELECT b.id FROM productvariants b
              WHERE b.productid = p.blankproductid AND b.sizeid = v.sizeid AND b.colorid = v.colorid LIMIT 1) AS "teeVariantId"
    FROM products p JOIN productvariants v ON v.productid = p.id
    JOIN sizes sz ON sz.id = v.sizeid JOIN colors col ON col.id = v.colorid
    WHERE p.name = 'Developer Everyday Design 1' AND sz.name = 'XL' AND col.name = 'Black' LIMIT 1`);
  const prov = await db.query(`SELECT value FROM settings WHERE key='delivery_provinces' LIMIT 1`);
  const provinces = JSON.parse(prov.rows[0]?.value || "[]");
  d = { ...r.rows[0], price: Number(r.rows[0].price), province: provinces[0]?.name || "Western", provinceFee: Number(provinces[0]?.fee || 0) };
});

test.afterAll(async () => {
  // Safety net: make sure stock is restored and the test order/customer are gone,
  // regardless of whether the in-test admin cancel succeeded.
  const db = testDb();
  if (orderId) {
    const o = await db.query(`SELECT stockdeducted FROM orders WHERE id=$1`, [orderId]);
    if (o.rows[0]?.stockdeducted) {
      await db.query(`UPDATE productvariants SET qty = qty + 1 WHERE id=$1`, [d.teeVariantId]);
    }
    await db.query(`DELETE FROM sales WHERE orderid=$1`, [orderId]);
    await db.query(`DELETE FROM orderitems WHERE orderid=$1`, [orderId]);
    await db.query(`DELETE FROM orderstatuslogs WHERE orderid=$1`, [orderId]);
    await db.query(`DELETE FROM dispatchmessages WHERE orderid=$1`, [orderId]).catch(() => {});
    await db.query(`DELETE FROM orders WHERE id=$1`, [orderId]);
  }
  await db.query(`DELETE FROM orders WHERE customerphone=$1`, [guest.phone]).catch(() => {});
  await db.query(`DELETE FROM customers WHERE phone=$1`, [guest.phone]).catch(() => {});
  await closeTestDb();
});

async function selectAndAdd(page: Page) {
  await page.goto(`/product/${d.slug}`, { waitUntil: "domcontentloaded" });
  await expect(async () => {
    await page.locator(`button[title="Black"]`).first().click({ timeout: 5_000 });
    await expect(page.getByText(`COLOUR: Black`).first()).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 45_000 });
  const chip = page.getByRole("button", { name: "XL", exact: true }).first();
  await expect(async () => {
    await chip.click({ timeout: 5_000 });
    await expect(chip).toHaveClass(/border-primary/, { timeout: 5_000 });
  }).toPass({ timeout: 45_000 });
  await expect(page.getByText(/In stock|Only \d+ left/).first()).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await expect(page.getByText("Added to cart").first()).toBeVisible();
}

async function goToCheckout(page: Page) {
  await expect(async () => {
    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: /Checkout/ }).click();
    await page.waitForURL(/\/checkout/, { timeout: 10_000 });
    await page.waitForTimeout(300);
    expect(page.url()).toContain("/checkout");
  }).toPass({ timeout: 30_000 });
}

test("guest buys a Developer Everyday design (XL/Black) — order records the design, shared tee stock drops", async ({ page }) => {
  const teeBefore = await fetchVariantQty(d.teeVariantId);

  await selectAndAdd(page);
  await page.goto("/cart", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(d.productName).first()).toBeVisible();

  await goToCheckout(page);
  await hydratedFill(page, "#checkout-name", guest.name);
  await page.locator("#checkout-phone").fill(guest.phone);
  await page.locator("#checkout-email").fill(guest.email);
  await page.getByRole("button", { name: "Province" }).click();
  await page.getByRole("option", { name: new RegExp(`^${d.province}`) }).click();
  await page.locator("#checkout-address").fill(guest.address);
  await page.locator("#checkout-password").fill(guest.password);

  await page.getByRole("button", { name: /Place order/ }).click();
  await page.waitForURL(/\/order\/[0-9a-f-]{36}/, { timeout: 45_000 });
  orderId = page.url().match(/\/order\/([0-9a-f-]{36})/)![1];

  // Confirmation shows the design
  await expect(page.getByText("Thank you for your order!")).toBeVisible();
  await expect(page.getByText(d.productName).first()).toBeVisible();

  // DB truth: order + the exact design variant + shared tee stock dropped by 1
  const order = await fetchOrder(orderId);
  expect(order.paymentstatus).toBe("Pending");
  expect(order.customer).toBe(guest.name);
  const items = await fetchOrderItems(orderId);
  expect(items).toHaveLength(1);
  expect(items[0].variantid).toBe(d.variantId);           // the chosen DESIGN (XL/Black)
  expect(await fetchVariantQty(d.teeVariantId)).toBe(teeBefore - 1); // SHARED tee pool deducted
});

test("admin cancels the order → shared tee stock is restocked", async ({ asAdmin }) => {
  const page = await asAdmin.newPage();
  await page.goto("/web-orders", { waitUntil: "domcontentloaded" });
  const card = page.locator("div.rounded-xl").filter({ hasText: `#${orderId.slice(0, 8).toUpperCase()}` }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.locator("select").first().selectOption("Canceled");
  await expect(page.getByText("Status updated").first()).toBeVisible({ timeout: 15_000 });

  await expect.poll(async () => (await fetchOrder(orderId)).paymentstatus, { timeout: 20_000 }).toBe("Canceled");
  expect((await fetchOrder(orderId)).stockdeducted).toBe(false); // stock returned to the pool
});
