// Unit tests for the pure DTF pricing formula (no DB).
//   perPiece = garment + Σ prints + overhead + profit;  total = perPiece*qty + orderExtra
// Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDtfTotals } from "../../src/lib/dtfTotals.ts";

test("single print — perPiece and total add up", () => {
  // garment 400 + print 150 + overhead 50 + profit 100 = 700/piece, x1, +0 extra.
  const r = computeDtfTotals({ garmentCost: 400, printAmounts: [150], overheadTotal: 50, profit: 100, orderExtra: 0, qty: 1 });
  assert.equal(r.printSum, 150);
  assert.equal(r.printCharges, 300); // 150 + 50 + 100
  assert.equal(r.perPiece, 700);
  assert.equal(r.total, 700);
});

test("multiple prints sum, qty multiplies, order extra is flat (added once)", () => {
  // garment 400 + (150+90) prints + 50 overhead + 100 profit = 790/piece.
  // x3 = 2370, + 200 flat order extra = 2570.
  const r = computeDtfTotals({ garmentCost: 400, printAmounts: [150, 90], overheadTotal: 50, profit: 100, orderExtra: 200, qty: 3 });
  assert.equal(r.printSum, 240);
  assert.equal(r.perPiece, 790);
  assert.equal(r.total, 2570);
});

test("no prints selected — just garment + overhead + profit", () => {
  const r = computeDtfTotals({ garmentCost: 400, printAmounts: [], overheadTotal: 50, profit: 100, orderExtra: 0, qty: 1 });
  assert.equal(r.printSum, 0);
  assert.equal(r.perPiece, 550);
  assert.equal(r.total, 550);
});

test("qty is clamped to a minimum of 1 and floored", () => {
  const base = { garmentCost: 400, printAmounts: [150], overheadTotal: 50, profit: 100, orderExtra: 0 };
  assert.equal(computeDtfTotals({ ...base, qty: 0 }).total, 700);   // clamp up to 1
  assert.equal(computeDtfTotals({ ...base, qty: -5 }).total, 700);  // clamp up to 1
  assert.equal(computeDtfTotals({ ...base, qty: 2.9 }).qty, 2);     // floored
});

test("negative / NaN amounts are treated as 0 (never reduce the price)", () => {
  const r = computeDtfTotals({ garmentCost: -100, printAmounts: [-50, NaN as unknown as number, 20], overheadTotal: -10, profit: -5, orderExtra: -30, qty: 1 });
  assert.equal(r.printSum, 20);       // only the valid 20 counts
  assert.equal(r.printCharges, 20);   // overhead/profit clamped to 0
  assert.equal(r.perPiece, 20);       // garment clamped to 0
  assert.equal(r.total, 20);          // orderExtra clamped to 0
});

test("order extra scales independently of qty", () => {
  const a = computeDtfTotals({ garmentCost: 100, printAmounts: [], overheadTotal: 0, profit: 0, orderExtra: 300, qty: 1 });
  const b = computeDtfTotals({ garmentCost: 100, printAmounts: [], overheadTotal: 0, profit: 0, orderExtra: 300, qty: 10 });
  assert.equal(a.total, 400);         // 100 + 300
  assert.equal(b.total, 1300);        // 100*10 + 300
});
