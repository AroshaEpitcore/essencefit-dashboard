// Smoke test — zero-dependency (Node's built-in runner). Verifies the money
// formatter. (Was vitest, which isn't installed; converted to node:test.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { money } from "../../src/components/shop/format.ts";

test("money() formats rupees with thousands separators", () => {
  assert.equal(money(1890), "Rs. 1,890");
});
