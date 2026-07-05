import { Pool } from "pg";

/* Standalone pool to the same Supabase database the app under test uses —
   for picking test products and asserting what checkout wrote. */
let pool: Pool | null = null;

export function testDb(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 2,
    });
  }
  return pool;
}

export async function closeTestDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/* Per-run unique identifiers so repeated runs don't collide. */
export function uniquePhone(): string {
  return "07" + String(Date.now()).slice(-7) + Math.floor(Math.random() * 10);
}
export function uniqueEmail(): string {
  return `autotest${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
}

/* ---------- Shorts-only catalogue discovery ----------
   The suite may ONLY order products in the "Shorts" category — never
   T-Shirts or Sleevless Skinner. Everything is picked live from the DB. */

export type ShortsVariant = {
  productId: string;
  productName: string;
  slug: string;
  variantId: string;
  qty: number;
  price: number;
  size: string | null;
  color: string | null;
};

export async function getShortsVariants(): Promise<ShortsVariant[]> {
  // Qty resolves through dbo.fn_StockVariantId exactly like the storefront
  // does — linked/signature products share their blank product's stock, so
  // the raw variant row's qty can be 0 while the product is sellable.
  const r = await testDb().query(`
    SELECT p.id AS productid, p.name AS productname, p.slug,
           v.id AS variantid,
           COALESCE((SELECT z.qty FROM productvariants z WHERE z.id = dbo.fn_StockVariantId(v.id)), 0)::int AS qty,
           COALESCE(v.sellingprice, p.sellingprice)::float8 AS price,
           s.name AS size, c.name AS color
    FROM products p
    JOIN categories cat ON cat.id = p.categoryid AND cat.name = 'Shorts'
    JOIN productvariants v ON v.productid = p.id
    LEFT JOIN sizes s ON s.id = v.sizeid
    LEFT JOIN colors c ON c.id = v.colorid
    WHERE p.isactive = true
    ORDER BY 5 DESC
  `);
  return r.rows.map((x) => ({
    productId: x.productid,
    productName: x.productname,
    slug: x.slug,
    variantId: x.variantid,
    qty: Number(x.qty),
    price: Number(x.price),
    size: x.size,
    color: x.color,
  }));
}

/* Belt-and-braces guard: fails the test if a product it is about to order is
   not in the Shorts category. */
export async function assertIsShorts(productId: string): Promise<void> {
  const r = await testDb().query(
    `SELECT c.name FROM products p JOIN categories c ON c.id = p.categoryid WHERE p.id = $1`,
    [productId]
  );
  const cat = r.rows[0]?.name;
  if (cat !== "Shorts") {
    throw new Error(`Test tried to order a non-Shorts product (category: ${cat ?? "unknown"}) — forbidden.`);
  }
}

/* ---------- Store settings the checkout math depends on ---------- */

export type DeliverySettings = {
  flatFee: number;
  freeDeliveryOver: number;
  provinces: { name: string; fee: number }[];
};

export async function getDeliverySettings(): Promise<DeliverySettings> {
  const r = await testDb().query(
    `SELECT key, value FROM settings WHERE key IN ('delivery_fee','free_delivery_over','delivery_provinces')`
  );
  const map: Record<string, string> = {};
  for (const row of r.rows) map[row.key] = row.value;
  let provinces: { name: string; fee: number }[] = [];
  try {
    const parsed = JSON.parse(map["delivery_provinces"] || "[]");
    if (Array.isArray(parsed)) provinces = parsed.map((p) => ({ name: String(p.name), fee: Number(p.fee) }));
  } catch {
    /* leave empty */
  }
  return {
    flatFee: Number(map["delivery_fee"] ?? 0) || 0,
    freeDeliveryOver: Number(map["free_delivery_over"] ?? 0) || 0,
    provinces,
  };
}

/* ---------- Assertion helpers ---------- */

export async function fetchOrder(orderId: string) {
  const r = await testDb().query(
    `SELECT id, customer, customerphone, secondaryphone, address, province, customeremail,
            notes, customerid, source, paymentmethod, paymentslipurl, paymentverified,
            paymentstatus, stockdeducted, completedat,
            subtotal::float8 AS subtotal, deliveryfee::float8 AS deliveryfee, total::float8 AS total
     FROM orders WHERE id = $1`,
    [orderId]
  );
  return r.rows[0] ?? null;
}

export async function fetchOrderItems(orderId: string) {
  const r = await testDb().query(
    `SELECT oi.variantid, oi.qty::int AS qty, oi.sellingprice::float8 AS sellingprice
     FROM orderitems oi WHERE oi.orderid = $1`,
    [orderId]
  );
  return r.rows;
}

export async function fetchStatusLogs(orderId: string) {
  const r = await testDb().query(
    `SELECT oldstatus, newstatus FROM orderstatuslogs WHERE orderid = $1 ORDER BY changedat`,
    [orderId]
  );
  return r.rows;
}

export async function fetchSalesCount(orderId: string): Promise<number> {
  const r = await testDb().query(`SELECT COUNT(*)::int AS n FROM sales WHERE orderid = $1`, [orderId]);
  return Number(r.rows[0].n);
}

export async function fetchVariantQty(variantId: string): Promise<number> {
  // Blank-aware: stock movements land on dbo.fn_StockVariantId(variant).
  const r = await testDb().query(
    `SELECT z.qty::int AS qty FROM productvariants z WHERE z.id = dbo.fn_StockVariantId($1)`,
    [variantId]
  );
  return Number(r.rows[0]?.qty ?? NaN);
}

export async function fetchCustomersByPhone(phone: string) {
  const r = await testDb().query(
    `SELECT id, name, phone, email, address, passwordhash FROM customers WHERE phone = $1`,
    [phone]
  );
  return r.rows;
}

export async function fetchOrderCountForPhone(phone: string): Promise<number> {
  const r = await testDb().query(`SELECT COUNT(*)::int AS n FROM orders WHERE customerphone = $1`, [phone]);
  return Number(r.rows[0].n);
}

export async function fetchStockHistory(variantId: string, limit = 3) {
  // Blank-aware: history rows are written against the resolved stock variant.
  const r = await testDb().query(
    `SELECT changeqty::int AS changeqty, reason, previousqty::int AS previousqty, newqty::int AS newqty
     FROM stockhistory WHERE variantid = dbo.fn_StockVariantId($1) ORDER BY createdat DESC LIMIT $2`,
    [variantId, limit]
  );
  return r.rows;
}
