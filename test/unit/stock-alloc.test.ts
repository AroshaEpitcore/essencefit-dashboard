// Unit tests for the own-first-then-blank stock allocation model (no DB).
// Mirrors the SQL contract in db/pg/patches/2026-10-18-own-first-stock-*.sql.
// Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availableQty,
  allocate,
  applyAllocation,
  restoreAllocation,
} from "../../src/lib/stockAlloc.ts";

// --- availableQty (fn_available_qty) --------------------------------------

test("availableQty — own only, no blank linked", () => {
  assert.equal(availableQty(5), 5);
  assert.equal(availableQty(5, 0), 5);
});

test("availableQty — own + blank pooled together", () => {
  assert.equal(availableQty(2, 8), 10);
});

test("availableQty — null/undefined pools count as 0", () => {
  assert.equal(availableQty(null, null), 0);
  assert.equal(availableQty(undefined, 4), 4);
});

// --- allocate (deduct_stock split) ----------------------------------------

test("allocate — fully covered by OWN stock, blank untouched", () => {
  // own=10, blank=5, need 3 -> all from own.
  assert.deepEqual(allocate(10, 5, 3), { ok: true, fromOwn: 3, fromBlank: 0, requested: 3 });
});

test("allocate — own drains first, remainder overflows to blank", () => {
  // own=2, blank=8, need 5 -> 2 own + 3 blank.
  assert.deepEqual(allocate(2, 8, 5), { ok: true, fromOwn: 2, fromBlank: 3, requested: 5 });
});

test("allocate — no own stock, everything comes from the blank", () => {
  assert.deepEqual(allocate(0, 8, 4), { ok: true, fromOwn: 0, fromBlank: 4, requested: 4 });
});

test("allocate — exact boundary (own+blank == request) still succeeds", () => {
  assert.deepEqual(allocate(2, 3, 5), { ok: true, fromOwn: 2, fromBlank: 3, requested: 5 });
});

test("allocate — short by one: nothing deducts (ok=false)", () => {
  // own=2, blank=3 => available 5; need 6 -> short, SQL returns false.
  assert.deepEqual(allocate(2, 3, 6), { ok: false, fromOwn: 0, fromBlank: 0, requested: 6 });
});

test("allocate — no blank linked and own is short", () => {
  assert.deepEqual(allocate(2, 0, 3), { ok: false, fromOwn: 0, fromBlank: 0, requested: 3 });
});

test("allocate — zero/negative request is a no-op success (p_qty <= 0)", () => {
  assert.deepEqual(allocate(5, 5, 0), { ok: true, fromOwn: 0, fromBlank: 0, requested: 0 });
  assert.deepEqual(allocate(5, 5, -4), { ok: true, fromOwn: 0, fromBlank: 0, requested: 0 });
});

test("allocate — fractional request is floored before splitting", () => {
  assert.deepEqual(allocate(10, 0, 2.9), { ok: true, fromOwn: 2, fromBlank: 0, requested: 2 });
});

// --- round-trip invariant (deduct then restore) ---------------------------

test("deduct → restore returns both pools to their exact starting values", () => {
  const own0 = 2, blank0 = 8;
  const a = allocate(own0, blank0, 5);
  const afterDeduct = applyAllocation(own0, blank0, a);
  assert.deepEqual(afterDeduct, { own: 0, blank: 5 }); // 2 own + 3 blank taken

  const afterRestore = restoreAllocation(afterDeduct.own, afterDeduct.blank, a);
  assert.deepEqual(afterRestore, { own: own0, blank: blank0 });
});

test("a short (failed) allocation leaves pools unchanged on both apply and restore", () => {
  const a = allocate(1, 1, 5); // ok:false
  assert.deepEqual(applyAllocation(1, 1, a), { own: 1, blank: 1 });
  assert.deepEqual(restoreAllocation(1, 1, a), { own: 1, blank: 1 });
});

test("the amount deducted always equals the amount requested when ok", () => {
  const a = allocate(4, 10, 9);
  assert.ok(a.ok);
  assert.equal(a.fromOwn + a.fromBlank, a.requested);
});
