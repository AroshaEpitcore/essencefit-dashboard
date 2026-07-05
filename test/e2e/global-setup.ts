import { Client } from "pg";

/* Sanity checks before the E2E run. The suite runs against the live Supabase
   database (there is no separate test DB any more), so instead of a reset we
   verify connectivity and that the "Shorts" catalogue the tests are allowed to
   order from actually has sellable stock. Tests must never touch T-Shirts or
   Sleevless Skinner products. */
export default async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — the E2E suite reads it from .env.local");
  }
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const r = await client.query(`
      SELECT COUNT(*)::int AS n
      FROM products p
      JOIN categories c ON c.id = p.categoryid AND c.name = 'Shorts'
      JOIN productvariants v ON v.productid = p.id
      WHERE p.isactive = true AND v.qty > 0
    `);
    if (!r.rows[0].n) {
      throw new Error("No in-stock 'Shorts' products found — the order-flow suite needs at least one.");
    }
  } finally {
    await client.end();
  }
}
