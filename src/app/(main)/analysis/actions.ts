"use server";

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
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    SELECT TOP 15
      p.Name AS name,
      SUM(s.Qty) AS qty,
      SUM(s.Qty * s.SellingPrice) AS revenue
    FROM Sales s
    JOIN ProductVariants v ON s.VariantId = v.Id
    JOIN Products p ON v.ProductId = p.Id
    WHERE ${dateClause("s", "SaleDate", range)}
    GROUP BY p.Name
    ORDER BY SUM(s.Qty) DESC
  `);
  return res.recordset;
}

/* 4. Best Selling Categories */
export async function getTopCategories(range: DateRange) {
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
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT
      pv.Id AS VariantId,
      p.Name AS ProductName,
      sz.Name AS SizeName,
      c.Name AS ColorName,
      pv.Qty,
      (SELECT TOP 1 CAST(s.SaleDate AS DATE)
       FROM Sales s WHERE s.VariantId = pv.Id
       ORDER BY s.SaleDate DESC) AS LastSold
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
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    ;WITH SalesMonth AS (
      SELECT
        FORMAT(s.SaleDate, 'yyyy-MM') AS M,
        FORMAT(s.SaleDate, 'MMM yy') AS Label,
        MIN(s.SaleDate) AS MinD,
        SUM(s.Qty * s.SellingPrice) AS GrossSales,
        SUM(s.Qty * ISNULL(v.CostPrice, ISNULL(p.CostPrice, 0))) AS Cogs
      FROM Sales s
      JOIN ProductVariants v ON s.VariantId = v.Id
      JOIN Products p ON v.ProductId = p.Id
      WHERE ${dateClause("s", "SaleDate", range)}
      GROUP BY FORMAT(s.SaleDate, 'yyyy-MM'), FORMAT(s.SaleDate, 'MMM yy')
    ),
    OrdersMonth AS (
      SELECT
        FORMAT(o.OrderDate, 'yyyy-MM') AS M,
        SUM(ISNULL(o.Discount,0)) AS DiscountAmt
      FROM Orders o
      WHERE o.PaymentStatus IN ('Paid','Completed')
        AND ${dateClause("o", "OrderDate", range)}
      GROUP BY FORMAT(o.OrderDate, 'yyyy-MM')
    )
    SELECT
      sm.Label AS month,
      ISNULL(sm.GrossSales,0) AS grossSales,
      ISNULL(sm.GrossSales,0) - ISNULL(om.DiscountAmt,0) AS netSales,
      (ISNULL(sm.GrossSales,0) - ISNULL(sm.Cogs,0)) - ISNULL(om.DiscountAmt,0) AS profit
    FROM SalesMonth sm
    LEFT JOIN OrdersMonth om ON sm.M = om.M
    ORDER BY sm.MinD
  `);
  return res.recordset;
}

/* 7. Daily Sales Trend (last 30 days) */
export async function getDailySalesTrend(range: DateRange) {
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    SELECT
      CONVERT(VARCHAR(10), CAST(s.SaleDate AS DATE), 120) AS date,
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
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    SELECT
      DATENAME(WEEKDAY, s.SaleDate) AS day,
      DATEPART(WEEKDAY, s.SaleDate) AS dayNum,
      SUM(s.Qty) AS qty,
      SUM(s.Qty * s.SellingPrice) AS revenue
    FROM Sales s
    WHERE ${dateClause("s", "SaleDate", range)}
    GROUP BY DATENAME(WEEKDAY, s.SaleDate), DATEPART(WEEKDAY, s.SaleDate)
    ORDER BY DATEPART(WEEKDAY, s.SaleDate)
  `);
  return res.recordset;
}

/* 9. Revenue vs Expenses */
export async function getRevenueVsExpenses(range: DateRange) {
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    ;WITH SalesMonth AS (
      SELECT
        FORMAT(s.SaleDate, 'yyyy-MM') AS M,
        FORMAT(s.SaleDate, 'MMM yy') AS Label,
        MIN(s.SaleDate) AS MinD,
        SUM(s.Qty * s.SellingPrice) AS Revenue,
        SUM(s.Qty * ISNULL(v.CostPrice, ISNULL(p.CostPrice, 0))) AS Cogs
      FROM Sales s
      JOIN ProductVariants v ON s.VariantId = v.Id
      JOIN Products p ON v.ProductId = p.Id
      WHERE ${dateClause("s", "SaleDate", range)}
      GROUP BY FORMAT(s.SaleDate, 'yyyy-MM'), FORMAT(s.SaleDate, 'MMM yy')
    ),
    ExpMonth AS (
      SELECT
        FORMAT(e.ExpenseDate, 'yyyy-MM') AS M,
        SUM(e.Amount) AS Expenses
      FROM Expenses e
      WHERE ${dateClause("e", "ExpenseDate", range)}
      GROUP BY FORMAT(e.ExpenseDate, 'yyyy-MM')
    )
    SELECT
      COALESCE(sm.Label,FORMAT(CAST(em.M+'-01' AS DATE),'MMM yy')) AS month,
      ISNULL(sm.Revenue,0) AS revenue,
      ISNULL(em.Expenses,0) AS expenses,
      ISNULL(sm.Revenue,0) - ISNULL(sm.Cogs,0) - ISNULL(em.Expenses,0) AS netProfit
    FROM SalesMonth sm
    FULL OUTER JOIN ExpMonth em ON sm.M = em.M
    ORDER BY ISNULL(sm.MinD, CAST(em.M+'-01' AS DATE))
  `);
  return res.recordset;
}

/* 10. Customer Leaderboard */
export async function getCustomerLeaderboard(range: DateRange) {
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    SELECT TOP 20
      ISNULL(o.Customer, 'Walk-in') AS name,
      o.CustomerPhone AS phone,
      COUNT(DISTINCT o.Id) AS orders,
      SUM(o.Total) AS totalSpent,
      MAX(o.OrderDate) AS lastOrder
    FROM Orders o
    WHERE o.PaymentStatus IN ('Paid','Completed')
      AND ${dateClause("o", "OrderDate", range)}
    GROUP BY o.Customer, o.CustomerPhone
    ORDER BY SUM(o.Total) DESC
  `);
  return res.recordset;
}

/* 11. Order Status Breakdown */
export async function getOrderStatusBreakdown(range: DateRange) {
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
  const pool = await getDb();
  const req = pool.request();
  bindDates(req, range);
  const res = await req.query(`
    SELECT
      FORMAT(o.OrderDate, 'MMM yy') AS month,
      MIN(o.OrderDate) AS MinD,
      COUNT(*) AS orders,
      AVG(o.Total) AS aov,
      SUM(o.Total) AS totalRevenue
    FROM Orders o
    WHERE o.PaymentStatus IN ('Paid','Completed')
      AND ${dateClause("o", "OrderDate", range)}
    GROUP BY FORMAT(o.OrderDate, 'MMM yy')
    ORDER BY MIN(o.OrderDate)
  `);
  return res.recordset;
}

/* Combined fetch for initial load */
export async function getAnalysisData(range: DateRange) {
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
