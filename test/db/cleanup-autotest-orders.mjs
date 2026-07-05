/* Removes the orders the E2E suite placed (customers named "AutoTest …"),
 * restores any stock they still hold, and deletes the AutoTest customer
 * accounts. Run it whenever you're done reviewing them in /web-orders:
 *
 *   node test/db/cleanup-autotest-orders.mjs
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnv(file) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
loadEnv(".env.local");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set (expected in .env.local)");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  await client.query("BEGIN");

  const orders = await client.query(
    `SELECT id, customer, stockdeducted FROM orders
     WHERE source = 'web' AND customer LIKE 'AutoTest%'`
  );
  console.log(`Found ${orders.rows.length} AutoTest web order(s).`);

  for (const o of orders.rows) {
    // Return stock still held by the order (canceled ones already gave it back)
    if (o.stockdeducted) {
      const items = await client.query(
        `SELECT variantid, qty::int AS qty FROM orderitems WHERE orderid = $1`,
        [o.id]
      );
      for (const it of items.rows) {
        const sv = await client.query(`SELECT dbo.fn_StockVariantId($1) AS vid`, [it.variantid]);
        const vid = sv.rows[0].vid;
        const prev = await client.query(`SELECT qty::int AS qty FROM productvariants WHERE id = $1`, [vid]);
        await client.query(`UPDATE productvariants SET qty = qty + $1 WHERE id = $2`, [it.qty, vid]);
        await client.query(
          `INSERT INTO stockhistory (variantid, changeqty, reason, previousqty, newqty, priceatchange, createdat)
           VALUES ($1, $2, 'order-cancel', $3, $4, 0, now())`,
          [vid, it.qty, prev.rows[0].qty, prev.rows[0].qty + it.qty]
        );
      }
    }
    await client.query(`DELETE FROM sales WHERE orderid = $1`, [o.id]);
    await client.query(`DELETE FROM orderstatuslogs WHERE orderid = $1`, [o.id]);
    await client.query(`DELETE FROM orderitems WHERE orderid = $1`, [o.id]);
    await client.query(`DELETE FROM orders WHERE id = $1`, [o.id]);
    console.log(`  removed order ${String(o.id).slice(0, 8)} (${o.customer})`);
  }

  const cust = await client.query(
    `DELETE FROM customers c
     WHERE c.name LIKE 'AutoTest%'
       AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customerid = c.id)
     RETURNING c.id`
  );
  console.log(`Removed ${cust.rows.length} AutoTest customer account(s).`);

  await client.query("COMMIT");
  console.log("Cleanup complete.");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Cleanup failed, rolled back:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
