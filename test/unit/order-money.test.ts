// Dummy unit tests for the canonical order money model (no DB).
// Run: npm run test:unit   (Node's built-in test runner + type stripping)
import { test } from "node:test";
import assert from "node:assert/strict";
import { orderTotal, orderNetRevenue, orderNetProfit } from "../../src/lib/orderMoney.ts";

test("normal order — customer pays delivery (pass-through)", () => {
  // 1 short @ 990, customer pays Rs 450 delivery to the courier; owner pays nothing.
  const i = { subtotal: 990, discount: 0, deliveryFee: 450, deliveryCost: 0, cogs: 600 };
  assert.equal(orderTotal(i), 1440);        // customer pays goods + delivery
  assert.equal(orderNetRevenue(i), 990);    // delivery is NOT business revenue
  assert.equal(orderNetProfit(i), 390);     // 990 − 600, delivery irrelevant to profit
});

test("free-delivery order — owner pays the courier (a cost)", () => {
  // 3 shorts @ 990 = 2970, free delivery; courier charges the owner Rs 450.
  const i = { subtotal: 2970, discount: 0, deliveryFee: 0, deliveryCost: 450, cogs: 1800 };
  assert.equal(orderTotal(i), 2970);        // customer pays full goods, free shipping
  assert.equal(orderNetRevenue(i), 2970);   // goods revenue
  assert.equal(orderNetProfit(i), 720);     // 2970 − 1800 − 450
});

test("real discount reduces revenue and profit; delivery is separate", () => {
  const i = { subtotal: 2970, discount: 300, deliveryFee: 0, deliveryCost: 450, cogs: 1800 };
  assert.equal(orderTotal(i), 2670);        // 2970 − 300
  assert.equal(orderNetRevenue(i), 2670);
  assert.equal(orderNetProfit(i), 420);     // 2670 − 1800 − 450
});

test("reclassification is profit-neutral vs the old 'delivery-as-discount' model", () => {
  // Old model folded the 450 free-delivery into discount; new model makes it a cost.
  const oldModelProfit = 2970 - (0 + 450) /*discount incl delivery*/ - 1800; // = 720
  const newModel = orderNetProfit({ subtotal: 2970, discount: 0, deliveryCost: 450, cogs: 1800 });
  assert.equal(newModel, oldModelProfit);   // same bottom line
});

test("total never goes negative", () => {
  assert.equal(orderTotal({ subtotal: 100, discount: 500 }), 0);
});
