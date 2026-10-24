"use server";

import { requireAdmin } from "@/lib/adminAuth";
import { getDb } from "@/lib/db";
import type { ItemProfitFilters, ItemProfitRow, OrderAdjustments, PrintJobTotals } from "./types";

/** Categories for the filter dropdown. */
export async function getCategories() {
  await requireAdmin();
  const pool = await getDb();
  const result = await pool.request().query(`
    SELECT Id, Name
    FROM Categories
    ORDER BY Name
  `);
  return result.recordset as Array<{ Id: string; Name: string }>;
}

/** Products for the filter dropdown; optionally scoped to a category. */
export async function getProducts(categoryId?: string) {
  await requireAdmin();
  const pool = await getDb();
  const req = pool.request();

  let sql = `SELECT Id, Name, CategoryId FROM Products`;
  if (categoryId) {
    sql += ` WHERE CategoryId = @catId`;
    req.input("catId", categoryId);
  }
  sql += ` ORDER BY Name`;

  const result = await req.query(sql);
  return result.recordset as Array<{ Id: string; Name: string; CategoryId: string }>;
}

/** Distinct sale channels (PaymentMethod) for the channel filter. */
export async function getChannels() {
  await requireAdmin();
  const pool = await getDb();
  const result = await pool.request().query(`
    SELECT DISTINCT PaymentMethod
    FROM Sales
    WHERE PaymentMethod IS NOT NULL AND PaymentMethod <> ''
    ORDER BY PaymentMethod
  `);
  return (result.recordset as Array<{ PaymentMethod: string }>).map((r) => r.PaymentMethod);
}

/**
 * Per-item sales breakdown — each variant's units, gross Revenue, Cost and
 * Profit kept separate so the page can roll them up by product or category and
 * show totals. Gross basis (Qty × SellingPrice / CostPrice): order-level
 * discounts and delivery fees are NOT attributed here since they can't be tied
 * to a single item — matches the scoped P&L on the Reports page.
 */
export async function runItemProfit(filters: ItemProfitFilters) {
  await requireAdmin();
  const pool = await getDb();

  const result = await pool
    .request()
    .input("CategoryId", filters.category || null)
    .input("ProductId", filters.product || null)
    .input("Channel", filters.channel || null)
    .input("From", filters.from || null)
    .input("To", filters.to || null)
    .query(`
      SELECT
        C.Name AS Category,
        P.Name AS Product,
        COALESCE(Sz.Name, '') AS Size,
        COALESCE(Cl.Name, '') AS Color,
        COALESCE(S.PaymentMethod, 'Other') AS PaymentMethod,
        SUM(S.Qty) AS Qty,
        CAST(SUM(S.Qty * S.SellingPrice) AS DECIMAL(18,2)) AS Revenue,
        CAST(SUM(S.Qty * S.CostPrice) AS DECIMAL(18,2)) AS Cost,
        CAST(SUM(S.Qty * S.SellingPrice) - SUM(S.Qty * S.CostPrice) AS DECIMAL(18,2)) AS Profit
      FROM Sales S
      JOIN ProductVariants V ON S.VariantId = V.Id
      JOIN Products P ON V.ProductId = P.Id
      JOIN Categories C ON P.CategoryId = C.Id
      LEFT JOIN Sizes Sz ON V.SizeId = Sz.Id
      LEFT JOIN Colors Cl ON V.ColorId = Cl.Id
      -- Casts are REQUIRED: these params are nullable and the mssql shim emits
      -- untyped $n, so Postgres cannot infer a type in the "$n IS NULL" test and
      -- throws 42P08 (could not determine data type) -- which surfaces in prod
      -- as the masked Server Components render 500. CategoryId/Id are uuid.
      WHERE ((@CategoryId)::uuid IS NULL OR P.CategoryId = (@CategoryId)::uuid)
        AND ((@ProductId)::uuid IS NULL OR P.Id = (@ProductId)::uuid)
        AND ((@Channel)::text IS NULL OR S.PaymentMethod = (@Channel)::text)
        AND ((@From)::date IS NULL OR CAST(S.SaleDate AS DATE) >= (@From)::date)
        AND ((@To)::date IS NULL OR CAST(S.SaleDate AS DATE) <= (@To)::date)
      GROUP BY C.Name, P.Name, Sz.Name, Cl.Name, COALESCE(S.PaymentMethod, 'Other')
      ORDER BY C.Name, P.Name, Sz.Name, Cl.Name
    `);

  return result.recordset as ItemProfitRow[];
}

/**
 * Order-level adjustments for a date range (Paid/Completed orders): total
 * Discount given (incl. free delivery) and DeliveryFee collected. These are
 * per-ORDER amounts that can't be attributed to an individual item, so the page
 * only applies them to the business-wide (unfiltered) net profit — matching the
 * Reports P&L. Casts on the nullable date params per untyped-null-param-42p08.
 */
export async function getOrderAdjustments(filters: {
  from?: string;
  to?: string;
}): Promise<OrderAdjustments> {
  await requireAdmin();
  const pool = await getDb();
  const result = await pool
    .request()
    .input("From", filters.from || null)
    .input("To", filters.to || null)
    .query(`
      SELECT
        CAST(COALESCE(SUM(COALESCE(Discount, 0)), 0) AS DECIMAL(18,2)) AS Discount,
        CAST(COALESCE(SUM(COALESCE(DeliveryFee, 0)), 0) AS DECIMAL(18,2)) AS DeliveryFee
      FROM Orders
      WHERE PaymentStatus IN ('Paid', 'Completed')
        AND ((@From)::date IS NULL OR CAST(OrderDate AS DATE) >= (@From)::date)
        AND ((@To)::date IS NULL OR CAST(OrderDate AS DATE) <= (@To)::date)
    `);
  return result.recordset[0] as OrderAdjustments;
}

/**
 * Real print-job figures for a date range, straight from the printjobs table
 * (charge/cost/profit), for display on the PrintJob channel card. The synced
 * sale row carries only the profit, so these are view-only and never feed the
 * page totals. Casts on the nullable date params per untyped-null-param-42p08.
 */
export async function getPrintJobTotals(filters: {
  from?: string;
  to?: string;
}): Promise<PrintJobTotals> {
  await requireAdmin();
  const pool = await getDb();
  const result = await pool
    .request()
    .input("From", filters.from || null)
    .input("To", filters.to || null)
    .query(`
      SELECT
        COALESCE(SUM(Qty), 0) AS Qty,
        CAST(COALESCE(SUM(TotalCharge), 0) AS DECIMAL(18,2)) AS Revenue,
        CAST(COALESCE(SUM(TotalCost), 0) AS DECIMAL(18,2)) AS Cost,
        CAST(COALESCE(SUM(TotalProfit), 0) AS DECIMAL(18,2)) AS Profit
      FROM PrintJobs
      WHERE ((@From)::date IS NULL OR CAST(CreatedAt AS DATE) >= (@From)::date)
        AND ((@To)::date IS NULL OR CAST(CreatedAt AS DATE) <= (@To)::date)
    `);
  return result.recordset[0] as PrintJobTotals;
}
