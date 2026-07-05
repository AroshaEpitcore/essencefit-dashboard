"use server";

import { requireAdmin } from "@/lib/adminAuth";

import { getDb } from "@/lib/db";

type DateRange = { from: string | null; to: string | null };

function dateClause(alias: string, col: string, range: DateRange): string {
  const parts: string[] = [];
  if (range.from) parts.push(`CAST(${alias}.${col} AS DATE) >= @from`);
  if (range.to) parts.push(`CAST(${alias}.${col} AS DATE) <= @to`);
  return parts.length ? parts.join(" AND ") : "1=1";
}

function bindDates(req: any, range: DateRange) {
  req.input("from", range.from ?? null);
  req.input("to", range.to ?? null);
  return req;
}

/* 1. Best Selling Colors */
export async function getTopColors(range: DateRange) {
  await requireAdmin();
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    SELECT c.Name AS name, SUM(s.Qty) AS qty
    FROM Sales s
    JOIN ProductVariants v ON s.VariantId = v.Id
    JOIN Colors c ON v.ColorId = c.Id
    WHERE ${dateClause("s", "SaleDate", range)}
    GROUP BY c.Name
    ORDER BY SUM(s.Qty) DESC
  `);
  return res.recordset;
}

/* 2. Best Selling Sizes */
export async function getTopSizes(range: DateRange) {
  await requireAdmin();
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    SELECT sz.Name AS name, SUM(s.Qty) AS qty
    FROM Sales s
    JOIN ProductVariants v ON s.VariantId = v.Id
    JOIN Sizes sz ON v.SizeId = sz.Id
    WHERE ${dateClause("s", "SaleDate", range)}
    GROUP BY sz.Name
    ORDER BY SUM(s.Qty) DESC
  `);
  return res.recordset;
}

/* 3. Best Selling Products */
export async function getTopProducts(range: DateRange) {
  await requireAdmin();
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    SELECT p.Name AS name,
      SUM(s.Qty) AS qty,
      SUM(s.Qty * s.SellingPrice) AS revenue
    FROM Sales s
    JOIN ProductVariants v ON s.VariantId = v.Id
    JOIN Products p ON v.ProductId = p.Id
    WHERE ${dateClause("s", "SaleDate", range)}
    GROUP BY p.Name
    ORDER BY SUM(s.Qty) DESC LIMIT 15
  `);
  return res.recordset;
}

/* 4. Best Selling Categories */
export async function getTopCategories(range: DateRange) {
  await requireAdmin();
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    SELECT cat.Name AS name, SUM(s.Qty * s.SellingPrice) AS revenue, SUM(s.Qty) AS qty
    FROM Sales s
    JOIN ProductVariants v ON s.VariantId = v.Id
    JOIN Products p ON v.ProductId = p.Id
    JOIN Categories cat ON p.CategoryId = cat.Id
    WHERE ${dateClause("s", "SaleDate", range)}
    GROUP BY cat.Name
    ORDER BY SUM(s.Qty * s.SellingPrice) DESC
  `);
  return res.recordset;
}

/* 5. Restock Alerts */
export async function getRestockAlerts() {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT
      pv.Id AS VariantId,
      p.Name AS ProductName,
      sz.Name AS SizeName,
      c.Name AS ColorName,
      pv.Qty,
      (SELECT CAST(s.SaleDate AS DATE)
       FROM Sales s WHERE s.VariantId = pv.Id
       ORDER BY s.SaleDate DESC LIMIT 1) AS LastSold
    FROM ProductVariants pv
    JOIN Products p ON pv.ProductId = p.Id
    JOIN Sizes sz ON pv.SizeId = sz.Id
    JOIN Colors c ON pv.ColorId = c.Id
    WHERE pv.Qty < 10
    ORDER BY pv.Qty ASC, p.Name
  `);
  return res.recordset;
}

/* 6. Monthly Sales Trend (last 12 months) */
export async function getMonthlySalesTrend(range: DateRange) {
  await requireAdmin();
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    WITH SalesMonth AS (
      SELECT
        to_char(s.SaleDate, 'YYYY-MM') AS M,
        to_char(s.SaleDate, 'Mon YY') AS Label,
        MIN(s.SaleDate) AS MinD,
        SUM(s.Qty * s.SellingPrice) AS GrossSales,
        SUM(s.Qty * s.CostPrice) AS Cogs
      FROM Sales s
      WHERE ${dateClause("s", "SaleDate", range)}
      GROUP BY to_char(s.SaleDate, 'YYYY-MM'), to_char(s.SaleDate, 'Mon YY')
    ),
    OrdersMonth AS (
      SELECT
        to_char(o.OrderDate, 'YYYY-MM') AS M,
        SUM(COALESCE(o.Discount,0)) AS DiscountAmt
      FROM Orders o
      WHERE o.PaymentStatus IN ('Paid','Completed')
        AND ${dateClause("o", "OrderDate", range)}
      GROUP BY to_char(o.OrderDate, 'YYYY-MM')
    )
    SELECT
      sm.Label AS month,
      COALESCE(sm.GrossSales,0) AS grossSales,
      COALESCE(sm.GrossSales,0) - COALESCE(om.DiscountAmt,0) AS netSales,
      (COALESCE(sm.GrossSales,0) - COALESCE(sm.Cogs,0)) - COALESCE(om.DiscountAmt,0) AS profit
    FROM SalesMonth sm
    LEFT JOIN OrdersMonth om ON sm.M = om.M
    ORDER BY sm.MinD
  `);
  return res.recordset;
}

/* 7. Daily Sales Trend (last 30 days) */
export async function getDailySalesTrend(range: DateRange) {
  await requireAdmin();
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    SELECT
      CAST(s.SaleDate AS DATE)::text AS date,
      SUM(s.Qty * s.SellingPrice) AS sales
    FROM Sales s
    WHERE ${dateClause("s", "SaleDate", range)}
    GROUP BY CAST(s.SaleDate AS DATE)
    ORDER BY CAST(s.SaleDate AS DATE)
  `);
  return res.recordset;
}

/* 8. Sales by Day of Week */
export async function getSalesByDayOfWeek(range: DateRange) {
  await requireAdmin();
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    SELECT
      to_char(s.SaleDate, 'FMDay') AS day,
      extract(dow from s.SaleDate) AS dayNum,
      SUM(s.Qty) AS qty,
      SUM(s.Qty * s.SellingPrice) AS revenue
    FROM Sales s
    WHERE ${dateClause("s", "SaleDate", range)}
    GROUP BY to_char(s.SaleDate, 'FMDay'), extract(dow from s.SaleDate)
    ORDER BY extract(dow from s.SaleDate)
  `);
  return res.recordset;
}

/* 9. Revenue vs Expenses */
export async function getRevenueVsExpenses(range: DateRange) {
  await requireAdmin();
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    WITH SalesMonth AS (
      SELECT
        to_char(s.SaleDate, 'YYYY-MM') AS M,
        to_char(s.SaleDate, 'Mon YY') AS Label,
        MIN(s.SaleDate) AS MinD,
        SUM(s.Qty * s.SellingPrice) AS Revenue,
        SUM(s.Qty * s.CostPrice) AS Cogs
      FROM Sales s
      WHERE ${dateClause("s", "SaleDate", range)}
      GROUP BY to_char(s.SaleDate, 'YYYY-MM'), to_char(s.SaleDate, 'Mon YY')
    ),
    ExpMonth AS (
      SELECT
        to_char(e.ExpenseDate, 'YYYY-MM') AS M,
        SUM(e.Amount) AS Expenses
      FROM Expenses e
      WHERE ${dateClause("e", "ExpenseDate", range)}
      GROUP BY to_char(e.ExpenseDate, 'YYYY-MM')
    )
    SELECT
      COALESCE(sm.Label,to_char(CAST(em.M || '-01' AS DATE), 'Mon YY')) AS month,
      COALESCE(sm.Revenue,0) AS revenue,
      COALESCE(em.Expenses,0) AS expenses,
      COALESCE(sm.Revenue,0) - COALESCE(sm.Cogs,0) - COALESCE(em.Expenses,0) AS netProfit
    FROM SalesMonth sm
    FULL OUTER JOIN ExpMonth em ON sm.M = em.M
    ORDER BY COALESCE(sm.MinD, CAST(em.M || '-01' AS DATE))
  `);
  return res.recordset;
}

/* 10. Customer Leaderboard */
export async function getCustomerLeaderboard(range: DateRange) {
  await requireAdmin();
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    SELECT COALESCE(o.Customer, 'Walk-in') AS name,
      o.CustomerPhone AS phone,
      COUNT(DISTINCT o.Id) AS orders,
      SUM(o.Total) AS totalSpent,
      MAX(o.OrderDate) AS lastOrder
    FROM Orders o
    WHERE o.PaymentStatus IN ('Paid','Completed')
      AND ${dateClause("o", "OrderDate", range)}
    GROUP BY o.Customer, o.CustomerPhone
    ORDER BY SUM(o.Total) DESC LIMIT 20
  `);
  return res.recordset;
}

/* 11. Order Status Breakdown */
export async function getOrderStatusBreakdown(range: DateRange) {
  await requireAdmin();
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    SELECT
      o.PaymentStatus AS name,
      COUNT(*) AS count,
      SUM(o.Total) AS total
    FROM Orders o
    WHERE ${dateClause("o", "OrderDate", range)}
    GROUP BY o.PaymentStatus
    ORDER BY
      CASE o.PaymentStatus
        WHEN 'Pending' THEN 1
        WHEN 'Partial' THEN 2
        WHEN 'Paid' THEN 3
        WHEN 'Completed' THEN 4
        WHEN 'Canceled' THEN 5
      END
  `);
  return res.recordset;
}

/* 12. Average Order Value Trend */
export async function getAovTrend(range: DateRange) {
  await requireAdmin();
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    SELECT
      to_char(o.OrderDate, 'Mon YY') AS month,
      MIN(o.OrderDate) AS MinD,
      COUNT(*) AS orders,
      AVG(o.Total) AS aov,
      SUM(o.Total) AS totalRevenue
    FROM Orders o
    WHERE o.PaymentStatus IN ('Paid','Completed')
      AND ${dateClause("o", "OrderDate", range)}
    GROUP BY to_char(o.OrderDate, 'Mon YY')
    ORDER BY MIN(o.OrderDate)
  `);
  return res.recordset;
}

/* Combined fetch for initial load */
export async function getAnalysisData(range: DateRange) {
  await requireAdmin();
  const [
    topColors,
    topSizes,
    topProducts,
    topCategories,
    restockAlerts,
    monthlySales,
    dailySales,
    dayOfWeek,
    revenueVsExpenses,
    customerLeaderboard,
    orderStatus,
    aovTrend,
  ] = await Promise.all([
    getTopColors(range),
    getTopSizes(range),
    getTopProducts(range),
    getTopCategories(range),
    getRestockAlerts(),
    getMonthlySalesTrend(range),
    getDailySalesTrend(range),
    getSalesByDayOfWeek(range),
    getRevenueVsExpenses(range),
    getCustomerLeaderboard(range),
    getOrderStatusBreakdown(range),
    getAovTrend(range),
  ]);

  return {
    topColors,
    topSizes,
    topProducts,
    topCategories,
    restockAlerts,
    monthlySales,
    dailySales,
    dayOfWeek,
    revenueVsExpenses,
    customerLeaderboard,
    orderStatus,
    aovTrend,
  };
}
