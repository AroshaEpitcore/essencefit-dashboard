// Unit tests for the WhatsApp bot's pure logic (no DB):
//   parseSize        — is the whole message just a size?
//   expandSizeAliases — map a typed size to all catalog spellings
//   formatStockReply  — turn stock rows into the customer-facing text
// Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseSize,
  expandSizeAliases,
  formatStockReply,
  parseImageTags,
  type ProductStock,
} from "../../src/lib/waReply.ts";

test("parseSize accepts bare numeric and letter sizes (any case / spacing)", () => {
  assert.equal(parseSize("32"), "32");
  assert.equal(parseSize("  34 "), "34");
  assert.equal(parseSize("L"), "L");
  assert.equal(parseSize("xl"), "xl");
  assert.equal(parseSize("3XL"), "3XL");
  assert.equal(parseSize("Large"), "Large");
});

test("parseSize rejects non-size messages", () => {
  assert.equal(parseSize("size 32 please"), null);
  assert.equal(parseSize("hi"), null);
  assert.equal(parseSize("black"), null);
  assert.equal(parseSize("320"), null); // 3 digits isn't a waist size
  assert.equal(parseSize(""), null);
});

test("expandSizeAliases merges the catalog's inconsistent spellings", () => {
  // Catalog stores both "L" and "Large" as separate Size rows — both must match.
  assert.deepEqual(expandSizeAliases("L"), ["l", "large"]);
  assert.deepEqual(expandSizeAliases("large"), ["l", "large"]);
  assert.deepEqual(expandSizeAliases("M"), ["m", "medium"]);
  assert.deepEqual(expandSizeAliases("3XL"), ["xxxl", "3xl"]);
  assert.deepEqual(expandSizeAliases("XXXL"), ["xxxl", "3xl"]);
  // Numeric sizes have no alias — pass through as-is.
  assert.deepEqual(expandSizeAliases("32"), ["32"]);
});

test("formatStockReply lists products, colours and quantities", () => {
  const stock: ProductStock[] = [
    {
      product: "Corduroy Shorts",
      category: "Shorts",
      colors: [
        { name: "Black", qty: 3 },
        { name: "Navy", qty: 1 },
      ],
    },
  ];
  const reply = formatStockReply("30", stock);
  assert.match(reply, /Size 30/);
  assert.match(reply, /\*Corduroy Shorts\*/); // bold product name
  assert.match(reply, /Black — 3/);
  assert.match(reply, /Navy — 1/);
  assert.match(reply, /reply කරන්න/); // call to action present
});

test("formatStockReply gives an out-of-stock message when nothing is available", () => {
  const reply = formatStockReply("32", []);
  assert.match(reply, /Size 32/);
  assert.match(reply, /stock නෑ/);
  assert.doesNotMatch(reply, /available colours/);
});

test("parseImageTags extracts known image keys and strips the tags", () => {
  const r = parseImageTags("Here is the chart 👇\n[[IMG:size-chart]]\nAnd colours [[IMG:colours]]");
  assert.deepEqual(r.imageKeys, ["size-chart", "colours"]);
  assert.doesNotMatch(r.text, /\[\[IMG/); // tags removed from the text
  assert.match(r.text, /Here is the chart/);
});

test("parseImageTags ignores unknown tags and de-dupes", () => {
  const r = parseImageTags("[[IMG:size-chart]] a [[IMG:size-chart]] b [[IMG:unknown]]");
  assert.deepEqual(r.imageKeys, ["size-chart"]); // de-duped, unknown dropped
});

test("parseImageTags with no tags returns text unchanged and no images", () => {
  const r = parseImageTags("just a normal reply");
  assert.equal(r.text, "just a normal reply");
  assert.deepEqual(r.imageKeys, []);
});
