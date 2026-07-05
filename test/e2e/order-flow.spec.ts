import type { Page, Locator } from "@playwright/test";
import { test, expect, loginContextAsCustomer } from "../fixtures/auth";
import {
  getShortsVariants,
  assertIsShorts,
  getDeliverySettings,
  fetchOrder,
  fetchOrderItems,
  fetchStatusLogs,
  fetchSalesCount,
  fetchVariantQty,
  fetchCustomersByPhone,
  fetchOrderCountForPhone,
  fetchStockHistory,
  uniquePhone,
  uniqueEmail,
  closeTestDb,
  type ShortsVariant,
  type DeliverySettings,
} from "../fixtures/db";

/*
 * Order-place flow — end to end against the live storefront + admin.
 *
 * Ground rules:
 *  - Orders use ONLY products in the "Shorts" category (guarded in code);
 *    T-Shirts and Sleevless Skinner are never touched.
 *  - Test customers are named "AutoTest …" so they're easy to spot/clean up
 *    (see test/db/cleanup-autotest-orders.mjs).
 *  - The test web server runs with RESEND_API_KEY blanked, so no order emails
 *    are sent to the store owner or to the fake customer addresses.
 *
 * Covered cases:
 *   1. Guest checkout, COD — order + items + stock + status log + account
 *   2. Admin "Website Orders" shows WHO placed the order (name/phone/address/items)
 *   3. Bank transfer — slip required, slip upload, order carries the slip
 *   4. Admin verifies bank payment → Paid (sales created), back to Pending (sales removed)
 *   5. Logged-in customer checkout — order linked to the same account, province fee applied
 *   6. Repeat guest with the same phone — no duplicate customer, password not overwritten
 *   7. Free delivery over the threshold + admin cancel returns the stock
 *   8. Checkout validation: name / phone / province / address / password
 *   9. Out-of-stock shorts cannot be ordered
 *  10. Quantity is clamped to available stock (PDP stepper + cart)
 */

/* Sizes render as short chips (Large → L) on the storefront. */
const SIZE_LABEL: Record<string, string> = {
  "EXTRA SMALL": "XS", SMALL: "S", SM: "S", MEDIUM: "M", MD: "M",
  LARGE: "L", LG: "L", "EXTRA LARGE": "XL", "2XL": "XXL", "3XL": "XXXL",
};
function sizeChip(name: string | null): string | null {
  if (!name) return null;
  const n = name.trim().toUpperCase();
  return SIZE_LABEL[n] ?? name.trim();
}

const runStamp = String(Date.now()).slice(-6);
const guest = {
  name: `AutoTest Buyer ${runStamp}`,
  phone: uniquePhone(),
  email: uniqueEmail(),
  password: "AutoTest#123",
  address: "12/4 Test Lane, Galle Road",
};

let catalog: ShortsVariant[] = [];
let delivery: DeliverySettings;
/** Set by case 1, reused by 5 (login) and 6 (repeat phone). */
let firstOrderCustomerId: string | null = null;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  catalog = await getShortsVariants();
  delivery = await getDeliverySettings();
  for (const productId of new Set(catalog.map((v) => v.productId))) {
    await assertIsShorts(productId);
  }
});

test.afterAll(async () => {
  await closeTestDb();
});

/* Pick a shorts variant with both size and colour and at least `minQty` stock,
   skipping any already claimed by this run so stock math stays independent. */
const claimed = new Set<string>();
function pickVariant(minQty: number, opts: { priceTimesQtyAtLeast?: number } = {}): ShortsVariant {
  const matches = catalog.filter(
    (x) =>
      x.size && x.color && !claimed.has(x.variantId) && x.qty >= minQty &&
      (opts.priceTimesQtyAtLeast === undefined || x.price * minQty >= opts.priceTimesQtyAtLeast) &&
      // Skip size/colour combos that exist as DUPLICATE variant rows (live data
      // has e.g. two "XL White" rows for one product; the PDP resolves the
      // first — possibly zero-stock — row, so such combos aren't reliably buyable).
      !catalog.some(
        (y) =>
          y.variantId !== x.variantId &&
          y.productId === x.productId && y.size === x.size && y.color === x.color
      )
  );
  // catalog is sorted by qty desc — qty-1 orders take the smallest adequate
  // variant so the deepest stock stays free for the free-delivery (bulk) test.
  const v = opts.priceTimesQtyAtLeast !== undefined ? matches[0] : matches[matches.length - 1];
  if (!v) throw new Error(`No shorts variant with qty >= ${minQty} available for this test run.`);
  claimed.add(v.variantId);
  return v;
}

function refOf(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

/* ---------- UI helpers ---------- */

/* Select colour+size on the PDP. Navigations use domcontentloaded (full `load`
   hangs on slow CDN images), so the page may not be hydrated yet when we get
   here — a click before hydration is silently lost. Retry each click until the
   UI reflects the selection. */
async function selectVariantOnPdp(page: Page, v: ShortsVariant) {
  await page.goto(`/product/${v.slug}`, { waitUntil: "domcontentloaded" });
  if (v.color) {
    await expect(async () => {
      await page.locator(`button[title="${v.color}"]`).first().click({ timeout: 2_000 });
      await expect(page.getByText(`COLOUR: ${v.color}`).first()).toBeVisible({ timeout: 1_500 });
    }).toPass({ timeout: 30_000 });
  }
  if (v.size) {
    const chip = page.getByRole("button", { name: sizeChip(v.size)!, exact: true }).first();
    await expect(async () => {
      await chip.click({ timeout: 2_000 });
      await expect(chip).toHaveClass(/border-primary/, { timeout: 1_500 });
    }).toPass({ timeout: 30_000 });
  }
}

async function addToCartViaPdp(page: Page, v: ShortsVariant, qty = 1) {
  await selectVariantOnPdp(page, v);
  // Availability line proves the exact variant (size+colour) is in stock.
  await expect(page.getByText(/In stock|Only \d+ left/).first()).toBeVisible();
  const stepper = page.locator("div.border-gray-300.rounded-full").first();
  for (let i = 1; i < qty; i++) await stepper.locator("button").last().click();
  await expect(stepper.locator("span")).toHaveText(String(qty));
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await expect(page.getByText("Added to cart").first()).toBeVisible();
}

async function goToCheckout(page: Page) {
  await page.goto("/cart", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: /Checkout/ }).click();
  await page.waitForURL(/\/checkout/);
}

async function selectProvince(page: Page, province: string) {
  await page.getByRole("button", { name: "Province" }).click();
  await page.getByRole("option", { name: new RegExp(`^${province}`) }).click();
}

async function fillGuestCheckout(
  page: Page,
  data: { name: string; phone: string; email?: string; address: string; province: string; password?: string; notes?: string }
) {
  await page.locator("#checkout-name").fill(data.name);
  await page.locator("#checkout-phone").fill(data.phone);
  if (data.email) await page.locator("#checkout-email").fill(data.email);
  await selectProvince(page, data.province);
  await page.locator("#checkout-address").fill(data.address);
  if (data.notes) await page.locator("#checkout-notes").fill(data.notes);
  if (data.password) await page.locator("#checkout-password").fill(data.password);
}

async function placeOrder(page: Page): Promise<string> {
  await page.getByRole("button", { name: /Place order/ }).click();
  await page.waitForURL(/\/order\/[0-9a-f-]{36}/, { timeout: 45_000 });
  const m = page.url().match(/\/order\/([0-9a-f-]{36})/);
  return m![1];
}

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

/* Admin: the order card on /web-orders identified by its #REF. */
function adminOrderCard(page: Page, orderId: string): Locator {
  return page.locator("div.rounded-xl").filter({ hasText: `#${refOf(orderId)}` }).first();
}

/* =======================================================================
 * 1. Guest checkout — COD happy path
 * ===================================================================== */

let order1Id: string;
let order1Variant: ShortsVariant;

test("guest places a COD order for shorts — order, items, stock, logs, account", async ({ page }) => {
  order1Variant = pickVariant(3);
  const qtyBefore = await fetchVariantQty(order1Variant.variantId);
  const province = delivery.provinces[0]; // e.g. Western

  await addToCartViaPdp(page, order1Variant, 1);

  // Cart shows the line with price and totals
  await page.goto("/cart", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(order1Variant.productName).first()).toBeVisible();

  await goToCheckout(page);
  await fillGuestCheckout(page, {
    name: guest.name,
    phone: guest.phone,
    email: guest.email,
    address: guest.address,
    province: province.name,
    password: guest.password,
    notes: "AutoTest order — safe to cancel",
  });

  // Delivery fee for the chosen province is shown before placing
  await expect(page.getByText("Delivery").first()).toBeVisible();

  order1Id = await placeOrder(page);

  // Confirmation page (auto-signed-in as the new account)
  await expect(page.getByText("Thank you for your order!")).toBeVisible();
  await expect(page.getByText(`Order #${refOf(order1Id)}`).first()).toBeVisible();
  await expect(page.getByText(order1Variant.productName).first()).toBeVisible();
  await expect(page.getByText("Cash on delivery").first()).toBeVisible();

  // ---- DB truth ----
  const order = await fetchOrder(order1Id);
  expect(order).not.toBeNull();
  expect(order.source).toBe("web");
  expect(order.paymentmethod).toBe("COD");
  expect(order.paymentstatus).toBe("Pending");
  expect(order.customer).toBe(guest.name);
  expect(order.customerphone).toBe(guest.phone);
  expect(order.province).toBe(province.name);
  expect(order.subtotal).toBeCloseTo(order1Variant.price, 2);
  const expectedFee = delivery.freeDeliveryOver > 0 && order1Variant.price >= delivery.freeDeliveryOver ? 0 : province.fee;
  expect(order.deliveryfee).toBeCloseTo(expectedFee, 2);
  expect(order.total).toBeCloseTo(order1Variant.price + expectedFee, 2);
  expect(order.stockdeducted).toBe(true);

  const items = await fetchOrderItems(order1Id);
  expect(items).toHaveLength(1);
  expect(items[0].variantid).toBe(order1Variant.variantId);
  expect(items[0].qty).toBe(1);
  expect(items[0].sellingprice).toBeCloseTo(order1Variant.price, 2);

  // Stock reduced by 1 and the movement logged
  expect(await fetchVariantQty(order1Variant.variantId)).toBe(qtyBefore - 1);
  const hist = await fetchStockHistory(order1Variant.variantId, 1);
  expect(hist[0].reason).toBe("order-sale");
  expect(hist[0].changeqty).toBe(-1);

  // Status log: → Pending
  const logs = await fetchStatusLogs(order1Id);
  expect(logs[0].newstatus).toBe("Pending");

  // Who placed it: the order is linked to a real customer account
  const customers = await fetchCustomersByPhone(guest.phone);
  expect(customers).toHaveLength(1);
  expect(customers[0].passwordhash).toBeTruthy(); // account created at checkout
  expect(order.customerid).toBe(customers[0].id);
  firstOrderCustomerId = customers[0].id;

  // No sales rows until admin marks it Paid
  expect(await fetchSalesCount(order1Id)).toBe(0);
});

/* =======================================================================
 * 2. Admin sees WHO placed the order
 * ===================================================================== */

test("admin Website Orders shows who placed the order, with items", async ({ asAdmin }) => {
  const page = await asAdmin.newPage();
  await page.goto("/web-orders", { waitUntil: "domcontentloaded" });

  const card = adminOrderCard(page, order1Id);
  await expect(card).toBeVisible();

  // Identity of the buyer: name, phone, address + province
  await expect(card.getByText(guest.name)).toBeVisible();
  await expect(card.getByText(new RegExp(guest.phone))).toBeVisible();
  await expect(card.getByText(new RegExp(guest.address.slice(0, 12)))).toBeVisible();
  await expect(card.getByText("Pending").first()).toBeVisible();
  await expect(card.getByText("COD")).toBeVisible();
  // Shorts are stocked products — the POD badge must not appear (it used to
  // show on every order: CAST(...AS BIT) returns the truthy string "0" in pg).
  await expect(card.getByText("Print on demand")).toHaveCount(0);

  // Expand items — shows what was bought (product + size/colour + qty × price)
  await card.getByRole("button", { name: /View items/ }).click();
  await expect(card.getByText(order1Variant.productName).first()).toBeVisible();
  if (order1Variant.color) {
    await expect(card.getByText(new RegExp(order1Variant.color)).first()).toBeVisible();
  }

  // The notification bell announces the freshly placed web order
  await page.getByRole("button", { name: "Notifications" }).click();
  await expect(page.getByText("New Website Order").first()).toBeVisible();
});

/* =======================================================================
 * 3 + 4. Bank transfer: slip required → upload → admin verify → Paid
 * ===================================================================== */

let order2Id: string;
const bankGuest = {
  name: `AutoTest Bank ${runStamp}`,
  phone: uniquePhone(),
  password: "AutoTest#123",
  address: "88 Bank Transfer Rd, Matara",
};

test("bank transfer requires a slip, uploads it, and the order carries it", async ({ page }) => {
  const v = pickVariant(3);
  await addToCartViaPdp(page, v, 1);
  await goToCheckout(page);
  await fillGuestCheckout(page, {
    name: bankGuest.name,
    phone: bankGuest.phone,
    address: bankGuest.address,
    province: delivery.provinces[1]?.name ?? delivery.provinces[0].name,
    password: bankGuest.password,
  });

  await page.getByRole("button", { name: /Bank transfer/ }).click();

  // Blocked without a slip
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByText("Please upload your bank transfer slip.").first()).toBeVisible();

  // Upload a slip, then place
  await page.locator('input[type="file"]').setInputFiles({
    name: "slip.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });
  await expect(page.getByText("Slip uploaded ✓")).toBeVisible({ timeout: 30_000 });

  order2Id = await placeOrder(page);
  await expect(page.getByText("Thank you for your order!")).toBeVisible();
  await expect(page.getByText("View uploaded slip")).toBeVisible();

  const order = await fetchOrder(order2Id);
  expect(order.paymentmethod).toBe("BankTransfer");
  expect(order.paymentslipurl).toBeTruthy();
  expect(order.paymentstatus).toBe("Pending");
  expect(order.paymentverified).toBeFalsy();
});

test("admin verifies the bank payment → Paid (sales created), back to Pending removes sales", async ({ asAdmin }) => {
  const page = await asAdmin.newPage();
  await page.goto("/web-orders", { waitUntil: "domcontentloaded" });

  // The unverified bank order shows under "Needs verification"
  await page.getByRole("button", { name: /Needs verification/ }).click();
  const card = adminOrderCard(page, order2Id);
  await expect(card).toBeVisible();
  await expect(card.getByText(bankGuest.name)).toBeVisible(); // who placed it
  await expect(card.getByRole("button", { name: /View slip/ })).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: /Verify payment/ }).click();
  await expect(page.getByText("Payment verified — order marked Paid").first()).toBeVisible();

  await expect.poll(async () => (await fetchOrder(order2Id)).paymentstatus, { timeout: 20_000 }).toBe("Paid");
  const paid = await fetchOrder(order2Id);
  expect(paid.paymentverified).toBe(true);
  expect(paid.completedat).toBeTruthy();
  expect(await fetchSalesCount(order2Id)).toBeGreaterThan(0);

  // Put it back to Pending so the test run doesn't inflate real sales figures
  await page.getByRole("button", { name: /^All/ }).click();
  const cardAgain = adminOrderCard(page, order2Id);
  await cardAgain.locator("select").selectOption("Pending");
  await expect(page.getByText("Status updated").first()).toBeVisible();
  await expect.poll(async () => (await fetchOrder(order2Id)).paymentstatus, { timeout: 20_000 }).toBe("Pending");
  expect(await fetchSalesCount(order2Id)).toBe(0);
});

/* =======================================================================
 * 5. Logged-in customer checkout
 * ===================================================================== */

let order3Id: string;

test("logged-in customer places an order — linked to the same account, prefilled details", async ({ page }) => {
  const v = pickVariant(3);

  // Real login through the UI with the account created in case 1
  await page.goto("/account/login", { waitUntil: "domcontentloaded" });
  await page.locator("#login-identifier").fill(guest.phone);
  await page.locator("#login-password").fill(guest.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Welcome back!").first()).toBeVisible();
  // The login push must actually land (guards the push+refresh cancellation bug)
  await page.waitForURL(/\/account/, { timeout: 30_000 });

  await addToCartViaPdp(page, v, 1);
  await goToCheckout(page);

  // Signed-in banner + prefilled contact details, no password required
  await expect(page.getByText(/Signed in as/)).toBeVisible();
  await expect(page.locator("#checkout-name")).toHaveValue(guest.name);
  await expect(page.locator("#checkout-password")).toHaveCount(0);

  const province = delivery.provinces[1] ?? delivery.provinces[0];
  await selectProvince(page, province.name);

  order3Id = await placeOrder(page);
  await expect(page.getByText("Thank you for your order!")).toBeVisible();

  const order = await fetchOrder(order3Id);
  expect(order.customerid).toBe(firstOrderCustomerId); // same account placed it
  const expectedFee = delivery.freeDeliveryOver > 0 && v.price >= delivery.freeDeliveryOver ? 0 : province.fee;
  expect(order.deliveryfee).toBeCloseTo(expectedFee, 2);

  // My-orders page lists it
  await page.goto("/account/orders", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(`#${refOf(order3Id)}`).first()).toBeVisible();
});

/* =======================================================================
 * 6. Repeat guest with the same phone — no duplicate customer
 * ===================================================================== */

test("second guest order with the same phone reuses the customer and keeps the password", async ({ page }) => {
  const v = pickVariant(3);
  const before = await fetchCustomersByPhone(guest.phone);
  expect(before).toHaveLength(1);
  const originalHash = before[0].passwordhash;

  await addToCartViaPdp(page, v, 1);
  await goToCheckout(page);
  await fillGuestCheckout(page, {
    name: guest.name,
    phone: guest.phone,
    address: guest.address,
    province: delivery.provinces[0].name,
    password: "DifferentPass#999", // must NOT replace the existing password
  });
  const orderId = await placeOrder(page);
  await expect(page.getByText("Thank you for your order!")).toBeVisible();

  const after = await fetchCustomersByPhone(guest.phone);
  expect(after).toHaveLength(1); // no duplicate customer row
  expect(after[0].passwordhash).toBe(originalHash); // password untouched
  expect((await fetchOrder(orderId)).customerid).toBe(after[0].id);
});

/* =======================================================================
 * 7. Free delivery threshold + admin cancel returns stock
 * ===================================================================== */

test("order over the free-delivery threshold ships free; admin cancel restores stock", async ({ page, asAdmin }) => {
  test.skip(delivery.freeDeliveryOver <= 0, "Free delivery is disabled in store settings");

  const needQty = Math.ceil(delivery.freeDeliveryOver / catalog[0].price);
  let v: ShortsVariant;
  try {
    v = pickVariant(needQty + 1, { priceTimesQtyAtLeast: delivery.freeDeliveryOver });
  } catch {
    test.skip(true, "No shorts variant has enough stock to cross the free-delivery threshold");
    return;
  }
  const qty = Math.ceil(delivery.freeDeliveryOver / v.price);
  const qtyBefore = await fetchVariantQty(v.variantId);

  await addToCartViaPdp(page, v, qty);
  await goToCheckout(page);

  // The summary switches to "Free" delivery before placing
  await expect(page.getByText("Free").first()).toBeVisible();

  await fillGuestCheckout(page, {
    name: `AutoTest FreeDel ${runStamp}`,
    phone: uniquePhone(),
    address: "45 Threshold Ave, Kandy",
    province: delivery.provinces[0].name,
    password: "AutoTest#123",
  });
  const orderId = await placeOrder(page);

  const order = await fetchOrder(orderId);
  expect(order.subtotal).toBeCloseTo(v.price * qty, 2);
  expect(order.deliveryfee).toBe(0);
  expect(order.total).toBeCloseTo(v.price * qty, 2);
  expect(await fetchVariantQty(v.variantId)).toBe(qtyBefore - qty);

  // Admin cancels → stock goes back to the pool
  const admin = await asAdmin.newPage();
  await admin.goto("/web-orders", { waitUntil: "domcontentloaded" });
  const card = adminOrderCard(admin, orderId);
  await card.locator("select").selectOption("Canceled");
  await expect(admin.getByText("Status updated").first()).toBeVisible();

  await expect.poll(async () => (await fetchOrder(orderId)).paymentstatus, { timeout: 20_000 }).toBe("Canceled");
  expect((await fetchOrder(orderId)).stockdeducted).toBe(false);
  expect(await fetchVariantQty(v.variantId)).toBe(qtyBefore); // fully restored
});

/* =======================================================================
 * 8. Checkout validation — nothing gets written
 * ===================================================================== */

test("checkout rejects missing name, phone, province, address and short password", async ({ page }) => {
  const v = pickVariant(2);
  const phone = uniquePhone();
  await addToCartViaPdp(page, v, 1);
  await goToCheckout(page);

  const place = () => page.getByRole("button", { name: /Place order/ }).click();

  await place();
  await expect(page.getByText("Please enter your name.").first()).toBeVisible();

  await page.locator("#checkout-name").fill(`AutoTest Validation ${runStamp}`);
  await place();
  await expect(page.getByText("Please enter your phone number.").first()).toBeVisible();

  await page.locator("#checkout-phone").fill(phone);
  if (delivery.provinces.length > 0) {
    await place();
    await expect(page.getByText("Please select your province.").first()).toBeVisible();
    await selectProvince(page, delivery.provinces[0].name);
  }

  await place();
  await expect(page.getByText("Please enter your delivery address.").first()).toBeVisible();

  await page.locator("#checkout-address").fill("1 Validation Street");
  await place();
  await expect(page.getByText(/Please choose a password/).first()).toBeVisible();

  await page.locator("#checkout-password").fill("123"); // too short
  await place();
  await expect(page.getByText(/Please choose a password/).first()).toBeVisible();

  // Nothing was created for this phone
  expect(await fetchOrderCountForPhone(phone)).toBe(0);
  expect(await fetchCustomersByPhone(phone)).toHaveLength(0);
});

/* =======================================================================
 * 9. Out-of-stock shorts cannot be ordered
 * ===================================================================== */

test("a fully out-of-stock shorts product cannot be added to the cart", async ({ page }) => {
  // A shorts product whose variants are ALL at zero (blank-aware) stock
  const byProduct = new Map<string, { slug: string; total: number }>();
  for (const v of catalog) {
    const e = byProduct.get(v.productId) ?? { slug: v.slug, total: 0 };
    e.total += Math.max(0, v.qty);
    byProduct.set(v.productId, e);
  }
  const oos = [...byProduct.values()].find((p) => p.total === 0);
  test.skip(!oos, "Every active shorts product currently has stock");

  await page.goto(`/product/${oos!.slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Out of stock").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to cart" }).first()).toBeDisabled();
});

test("a sold-out size/colour combination is disabled on the PDP", async ({ page }) => {
  // A zero-stock variant whose colour still has stock in another size — the
  // colour stays clickable, but that size chip must be disabled.
  const dead = catalog.find(
    (x) =>
      x.size && x.color && x.qty === 0 &&
      catalog.some((y) => y.productId === x.productId && y.color === x.color && y.size !== x.size && y.qty > 0)
  );
  test.skip(!dead, "No sold-out size/colour combination available right now");
  const v = dead!;

  await page.goto(`/product/${v.slug}`, { waitUntil: "domcontentloaded" });
  await expect(async () => {
    await page.locator(`button[title="${v.color}"]`).first().click({ timeout: 2_000 });
    await expect(page.getByText(`COLOUR: ${v.color}`).first()).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: sizeChip(v.size)!, exact: true }).first()).toBeDisabled();
});

/* =======================================================================
 * 10. Quantity clamped to stock
 * ===================================================================== */

test("PDP stepper and cart clamp the quantity to available stock", async ({ page }) => {
  const low = catalog.find(
    (x) =>
      x.size && x.color && !claimed.has(x.variantId) && x.qty >= 1 && x.qty <= 4 &&
      !catalog.some(
        (y) =>
          y.variantId !== x.variantId &&
          y.productId === x.productId && y.size === x.size && y.color === x.color
      )
  );
  test.skip(!low, "No low-stock shorts variant available to exercise the clamp");
  const v = low!;

  await selectVariantOnPdp(page, v);

  const stepper = page.locator("div.border-gray-300.rounded-full").first();
  for (let i = 0; i < v.qty + 3; i++) await stepper.locator("button").last().click();
  await expect(stepper.locator("span")).toHaveText(String(v.qty)); // clamped on the PDP

  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await expect(page.getByText("Added to cart").first()).toBeVisible();

  await page.goto("/cart", { waitUntil: "domcontentloaded" });
  const cartStepper = page.locator("div.border-gray-300.rounded-full").first();
  await cartStepper.locator("button").last().click(); // try to exceed in the cart
  await expect(cartStepper.locator("span")).toHaveText(String(v.qty)); // still clamped
});
