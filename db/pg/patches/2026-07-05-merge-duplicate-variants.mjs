/* One-time data repair (plan: workflow/plans/2026-07-05-storefront-admin-gap-analysis.md, Phase 1).
 *
 * The storefront resolves colours/variants by id, so duplicate rows with the
 * same NAME split stock invisibly (live case: two "White" colours gave
 * Ck Sport short two XL/White variants — one stocked, one empty — and the PDP
 * resolved the empty one). Repair, in ONE transaction:
 *   1. merge colours (and sizes) whose names collide case-insensitively,
 *      repointing productvariants/productimages to the most-referenced row;
 *   2. merge variant rows that now (or already) collide on
 *      (productid, sizeid, colorid): repoint every referencing table to the
 *      keeper, sum the qty, delete the duplicate.
 * Idempotent: re-running reports "0 duplicate groups".
 *
 *   node db/pg/patches/2026-07-05-merge-duplicate-variants.mjs
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const env = fs.readFileSync(path.resolve(".env.local"), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + '="?([^"\\n]+)"?', "m")) || [])[1];
const url = get("DIRECT_URL") || get("DATABASE_URL");
if (!url) { console.error("No DIRECT_URL/DATABASE_URL in .env.local"); process.exit(1); }

const VARIANT_REFS = [
  "orderitems", "sales", "stockhistory", "purchases",
  "salesreturnitems", "purchasereturnitems", "dtforders", "productimages",
];

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  await client.query("BEGIN");

  // ---- 1. Duplicate lookup rows (colors, sizes) by case-insensitive name ----
  for (const table of ["colors", "sizes"]) {
    const col = table === "colors" ? "colorid" : "sizeid";
    const groups = await client.query(`
      SELECT LOWER(TRIM(name)) AS key, array_agg(id) AS ids, array_agg(name) AS names
      FROM ${table} GROUP BY 1 HAVING COUNT(*) > 1
    `);
    for (const g of groups.rows) {
      // keeper = the id referenced by the most variants (ties: most images)
      const ranked = [];
      for (const id of g.ids) {
        const v = await client.query(`SELECT COUNT(*)::int n FROM productvariants WHERE ${col} = $1`, [id]);
        const i = table === "colors"
          ? await client.query(`SELECT COUNT(*)::int n FROM productimages WHERE colorid = $1`, [id])
          : { rows: [{ n: 0 }] };
        ranked.push({ id, refs: v.rows[0].n * 1000 + i.rows[0].n });
      }
      ranked.sort((a, b) => b.refs - a.refs);
      const keeper = ranked[0].id;
      for (const { id } of ranked.slice(1)) {
        await client.query(`UPDATE productvariants SET ${col} = $1 WHERE ${col} = $2`, [keeper, id]);
        if (table === "colors") {
          await client.query(`UPDATE productimages SET colorid = $1 WHERE colorid = $2`, [keeper, id]);
        }
        await client.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
        console.log(`merged ${table} "${g.names[0]}": ${id.slice(0, 8)} -> ${keeper.slice(0, 8)}`);
      }
    }
    if (!groups.rows.length) console.log(`${table}: 0 duplicate name groups`);
  }

  // ---- 2. Duplicate variant rows on (productid, sizeid, colorid) ----
  const dupes = await client.query(`
    SELECT productid, sizeid, colorid, array_agg(id) AS ids
    FROM productvariants
    WHERE sizeid IS NOT NULL AND colorid IS NOT NULL
    GROUP BY productid, sizeid, colorid HAVING COUNT(*) > 1
  `);
  for (const g of dupes.rows) {
    // keeper = the row with the most stock-history (ties: highest qty)
    const ranked = [];
    for (const id of g.ids) {
      const h = await client.query(`SELECT COUNT(*)::int n FROM stockhistory WHERE variantid = $1`, [id]);
      const q = await client.query(`SELECT qty::int q FROM productvariants WHERE id = $1`, [id]);
      ranked.push({ id, hist: h.rows[0].n, qty: q.rows[0].q });
    }
    ranked.sort((a, b) => b.hist - a.hist || b.qty - a.qty);
    const keeper = ranked[0].id;
    for (const dupe of ranked.slice(1)) {
      for (const t of VARIANT_REFS) {
        const r = await client.query(`UPDATE ${t} SET variantid = $1 WHERE variantid = $2`, [keeper, dupe.id]);
        if (r.rowCount) console.log(`  repointed ${r.rowCount} ${t} row(s)`);
      }
      await client.query(`UPDATE productvariants SET qty = qty + $1 WHERE id = $2`, [dupe.qty, keeper]);
      await client.query(`DELETE FROM productvariants WHERE id = $1`, [dupe.id]);
      console.log(`merged variant ${dupe.id.slice(0, 8)} (qty ${dupe.qty}) -> ${keeper.slice(0, 8)}`);
    }
  }
  console.log(`variants: ${dupes.rows.length} duplicate group(s) merged`);

  await client.query("COMMIT");
  console.log("Done.");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Rolled back:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
