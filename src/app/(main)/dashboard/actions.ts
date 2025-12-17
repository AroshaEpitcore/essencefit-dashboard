"use server";

import { getDb } from "@/lib/db";

export async function getDashboardStats() {
  const pool = await getDb();
  const result = await pool.request().query(`
    DECLARE @Today DATE = CAST(GETDATE() AS DATE);
    DECLARE @MonthStart DATE = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);

    SELECT
      /* ---------------- Stock ---------------- */
      (SELECT ISNULL(SUM(Qty),0) FROM ProductVariants) AS TotalStock,

      /* ---------------- Sales ---------------- */
      (SELECT ISNULL(SUM(S.Qty * S.SellingPrice),0)
       FROM Sales S
       WHERE CAST(S.SaleDate AS DATE) = @Today) AS TodaysSales,

      (SELECT ISNULL(SUM(S.Qty * S.SellingPrice),0)
       FROM Sales S
       WHERE S.SaleDate >= @MonthStart) AS ThisMonthSales,

      /* ---------------- Profit (Gross) ---------------- */
      (SELECT ISNULL(SUM((S.Qty * S.SellingPrice) - (S.Qty * P.CostPrice)),0)
       FROM Sales S
       JOIN ProductVariants V ON S.VariantId = V.Id
       JOIN Products P ON V.ProductId = P.Id
       WHERE S.SaleDate >= @MonthStart) AS ThisMonthProfit,

      /* ---------------- Units Sold ---------------- */
      (SELECT ISNULL(SUM(S.Qty),0)
       FROM Sales S
       WHERE CAST(S.SaleDate AS DATE) = @Today) AS UnitsSoldToday,

      (SELECT ISNULL(SUM(S.Qty),0)
       FROM Sales S
       WHERE S.SaleDate >= @MonthStart) AS UnitsSoldMonth,

      /* ---------------- Expenses ---------------- */
      (SELECT ISNULL(SUM(E.Amount),0)
       FROM Expenses E
       WHERE E.ExpenseDate >= @MonthStart) AS ExpensesMonth,

      /* ---------------- Net (Gross - Expenses) ---------------- */
      (SELECT
         ISNULL(SUM((S.Qty * S.SellingPrice) - (S.Qty * P.CostPrice)),0)
         - ISNULL((SELECT SUM(E.Amount) FROM Expenses E WHERE E.ExpenseDate >= @MonthStart),0)
       FROM Sales S
       JOIN ProductVariants V ON S.VariantId = V.Id
       JOIN Products P ON V.ProductId = P.Id
       WHERE S.SaleDate >= @MonthStart) AS ThisMonthNet,

      /* ---------------- All-time Totals ---------------- */
      (SELECT ISNULL(SUM(S.Qty * S.SellingPrice),0) FROM Sales S) AS AllTimeSales,

      (SELECT ISNULL(SUM((S.Qty * S.SellingPrice) - (S.Qty * P.CostPrice)),0)
       FROM Sales S
       JOIN ProductVariants V ON S.VariantId = V.Id
       JOIN Products P ON V.ProductId = P.Id) AS AllTimeProfit,

      /* ---------------- Counts ---------------- */
      (SELECT COUNT(*) FROM Products) AS Products,
      (SELECT COUNT(*) FROM ProductVariants) AS Variants,
      (SELECT COUNT(*) FROM ProductVariants WHERE Qty < 5) AS LowStock,

      /* ✅ Orders counts */
      (SELECT COUNT(*) FROM Orders WHERE CAST(OrderDate AS DATE) = @Today) AS OrdersToday,
      (SELECT COUNT(*) FROM Orders WHERE OrderDate >= @MonthStart) AS OrdersMonth,

      /* ✅ New Orders = Pending only (since you don't have "Processing") */
      (SELECT COUNT(*) FROM Orders WHERE PaymentStatus = 'Pending') AS NewOrdersCount
  `);

  return result.recordset[0];
}

export async function getLowStockItems() {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT 
      V.Id AS VariantId, 
      P.Name AS ProductName, 
      S.Name AS SizeName, 
      C.Name AS ColorName, 
      V.Qty 
    FROM ProductVariants V
    JOIN Products P ON V.ProductId = P.Id
    JOIN Sizes S ON V.SizeId = S.Id
    JOIN Colors C ON V.ColorId = C.Id
    WHERE V.Qty < 5
    ORDER BY V.Qty ASC
  `);
  return { lowStockItems: res.recordset };
}

export async function getChartData() {
  const pool = await getDb();

  // Monthly summary for last 6 months
  const monthly = await pool.request().query(`
    SELECT TOP 6
      FORMAT(S.SaleDate, 'MMM yyyy') AS month,
      SUM(S.Qty*S.SellingPrice) AS sales,
      SUM((S.Qty*S.SellingPrice)-(S.Qty*P.CostPrice)) AS profit
    FROM Sales S
    JOIN ProductVariants V ON S.VariantId = V.Id
    JOIN Products P ON V.ProductId = P.Id
    GROUP BY FORMAT(S.SaleDate, 'MMM yyyy')
    ORDER BY MIN(S.SaleDate)
  `);

  // Daily sales for last 14 days
  const daily = await pool.request().query(`
    SELECT TOP 14
      CONVERT(VARCHAR(10), CAST(S.SaleDate AS DATE), 120) AS date,
      SUM(S.Qty*S.SellingPrice) AS sales
    FROM Sales S
    GROUP BY CAST(S.SaleDate AS DATE)
    ORDER BY MIN(S.SaleDate)
  `);

  return { monthly: monthly.recordset, daily: daily.recordset };
}
