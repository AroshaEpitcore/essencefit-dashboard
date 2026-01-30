"use server";

import { getDb } from "@/lib/db";

export async function getDashboardStats() {
  const pool = await getDb();

  const result = await pool.request().query(`
    DECLARE @Today DATE = CAST(GETDATE() AS DATE);
    DECLARE @MonthStart DATE = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);

    /* ---------------- Aggregates from Sales ---------------- */
    ;WITH SalesAgg AS (
      SELECT
        CAST(S.SaleDate AS DATE) AS D,
        SUM(S.Qty * S.SellingPrice) AS GrossSales,
        SUM(S.Qty) AS UnitsSold,
        SUM(S.Qty * P.CostPrice) AS Cogs
      FROM Sales S
      JOIN ProductVariants V ON S.VariantId = V.Id
      JOIN Products P ON V.ProductId = P.Id
      GROUP BY CAST(S.SaleDate AS DATE)
    ),
    OrdersAgg AS (
      SELECT
        CAST(O.OrderDate AS DATE) AS D,
        SUM(ISNULL(O.Discount,0)) AS OrderDiscount,
        SUM(ISNULL(O.DeliveryFee,0)) AS DeliveryFee
      FROM Orders O
      WHERE O.PaymentStatus IN ('Paid', 'Completed')
      GROUP BY CAST(O.OrderDate AS DATE)
    ),
    DayJoin AS (
      SELECT
        COALESCE(SA.D, OA.D) AS D,
        ISNULL(SA.GrossSales,0) AS GrossSales,
        ISNULL(SA.UnitsSold,0) AS UnitsSold,
        ISNULL(SA.Cogs,0) AS Cogs,
        ISNULL(OA.OrderDiscount,0) AS OrderDiscount,
        ISNULL(OA.DeliveryFee,0) AS DeliveryFee
      FROM SalesAgg SA
      FULL OUTER JOIN OrdersAgg OA ON SA.D = OA.D
    )
    SELECT
      /* ---------------- Stock ---------------- */
      (SELECT ISNULL(SUM(Qty),0) FROM ProductVariants) AS TotalStock,

      /* ---------------- Sales (NET) ----------------
         Net = Gross - Discount + DeliveryFee
      */
      (SELECT ISNULL(SUM(GrossSales - OrderDiscount + DeliveryFee),0)
       FROM DayJoin
       WHERE D = @Today) AS TodaysSales,

      (SELECT ISNULL(SUM(GrossSales - OrderDiscount + DeliveryFee),0)
       FROM DayJoin
       WHERE D >= @MonthStart) AS ThisMonthSales,

      /* ---------------- Profit (NET) ----------------
         NetProfit = (Gross - COGS) - Discount + DeliveryFee
      */
      (SELECT ISNULL(SUM((GrossSales - Cogs) - OrderDiscount + DeliveryFee),0)
       FROM DayJoin
       WHERE D >= @MonthStart) AS ThisMonthProfit,

      /* ---------------- Units Sold ---------------- */
      (SELECT ISNULL(SUM(UnitsSold),0)
       FROM DayJoin
       WHERE D = @Today) AS UnitsSoldToday,

      (SELECT ISNULL(SUM(UnitsSold),0)
       FROM DayJoin
       WHERE D >= @MonthStart) AS UnitsSoldMonth,

      /* ---------------- All-time Units Sold ---------------- */
      (SELECT ISNULL(SUM(UnitsSold),0)
       FROM DayJoin) AS AllTimeUnitsSold,

      /* ---------------- Expenses ---------------- */
      (SELECT ISNULL(SUM(E.Amount),0)
       FROM Expenses E
       WHERE E.ExpenseDate >= @MonthStart) AS ExpensesMonth,

      /* ---------------- Net (Profit - Expenses) ---------------- */
      (
        (SELECT ISNULL(SUM((GrossSales - Cogs) - OrderDiscount + DeliveryFee),0)
         FROM DayJoin
         WHERE D >= @MonthStart)
        - ISNULL((SELECT SUM(E.Amount) FROM Expenses E WHERE E.ExpenseDate >= @MonthStart),0)
      ) AS ThisMonthNet,

      /* ---------------- All-time Totals ---------------- */
      (SELECT ISNULL(SUM(GrossSales - OrderDiscount + DeliveryFee),0) FROM DayJoin) AS AllTimeSales,

      (SELECT ISNULL(SUM((GrossSales - Cogs) - OrderDiscount + DeliveryFee),0) FROM DayJoin) AS AllTimeProfit,

      /* ---------------- Counts ---------------- */
      (SELECT COUNT(*) FROM Products) AS Products,
      (SELECT COUNT(*) FROM ProductVariants) AS Variants,
      (SELECT COUNT(*) FROM ProductVariants WHERE Qty < 5) AS LowStock,

      /* ---------------- Orders counts ---------------- */
      (SELECT COUNT(*) FROM Orders WHERE CAST(OrderDate AS DATE) = @Today) AS OrdersToday,
      (SELECT COUNT(*) FROM Orders WHERE OrderDate >= @MonthStart) AS OrdersMonth,

      /* ---------------- Pending orders ---------------- */
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

  // ✅ Monthly (Net) Sales + (Net) Profit
  const monthly = await pool.request().query(`
    ;WITH SalesMonth AS (
      SELECT
        FORMAT(S.SaleDate, 'MMM yyyy') AS M,
        MIN(S.SaleDate) AS MinD,
        SUM(S.Qty * S.SellingPrice) AS GrossSales,
        SUM(S.Qty * P.CostPrice) AS Cogs
      FROM Sales S
      JOIN ProductVariants V ON S.VariantId = V.Id
      JOIN Products P ON V.ProductId = P.Id
      GROUP BY FORMAT(S.SaleDate, 'MMM yyyy')
    ),
    OrdersMonth AS (
      SELECT
        FORMAT(O.OrderDate, 'MMM yyyy') AS M,
        SUM(ISNULL(O.Discount,0)) AS DiscountAmt,
        SUM(ISNULL(O.DeliveryFee,0)) AS DeliveryAmt
      FROM Orders O
      WHERE O.PaymentStatus IN ('Paid', 'Completed')
      GROUP BY FORMAT(O.OrderDate, 'MMM yyyy')
    )
    SELECT TOP 6
      COALESCE(SM.M, OM.M) AS month,
      ISNULL(SM.GrossSales,0) - ISNULL(OM.DiscountAmt,0) + ISNULL(OM.DeliveryAmt,0) AS sales,
      (ISNULL(SM.GrossSales,0) - ISNULL(SM.Cogs,0)) - ISNULL(OM.DiscountAmt,0) + ISNULL(OM.DeliveryAmt,0) AS profit
    FROM SalesMonth SM
    FULL OUTER JOIN OrdersMonth OM ON SM.M = OM.M
    ORDER BY ISNULL(SM.MinD, GETDATE())
  `);

  // ✅ Daily (Net) Sales last 14 days
  const daily = await pool.request().query(`
    DECLARE @From DATE = DATEADD(DAY, -13, CAST(GETDATE() AS DATE));

    ;WITH SalesDay AS (
      SELECT
        CAST(S.SaleDate AS DATE) AS D,
        SUM(S.Qty * S.SellingPrice) AS GrossSales
      FROM Sales S
      WHERE CAST(S.SaleDate AS DATE) >= @From
      GROUP BY CAST(S.SaleDate AS DATE)
    ),
    OrdersDay AS (
      SELECT
        CAST(O.OrderDate AS DATE) AS D,
        SUM(ISNULL(O.Discount,0)) AS DiscountAmt,
        SUM(ISNULL(O.DeliveryFee,0)) AS DeliveryAmt
      FROM Orders O
      WHERE CAST(O.OrderDate AS DATE) >= @From
        AND O.PaymentStatus IN ('Paid', 'Completed')
      GROUP BY CAST(O.OrderDate AS DATE)
    )
    SELECT TOP 14
      CONVERT(VARCHAR(10), COALESCE(SD.D, OD.D), 120) AS date,
      ISNULL(SD.GrossSales,0) - ISNULL(OD.DiscountAmt,0) + ISNULL(OD.DeliveryAmt,0) AS sales
    FROM SalesDay SD
    FULL OUTER JOIN OrdersDay OD ON SD.D = OD.D
    ORDER BY COALESCE(SD.D, OD.D) DESC
  `);

  return { monthly: monthly.recordset, daily: daily.recordset };
}

export async function getAnalyticsData() {
  const pool = await getDb();

  // Weekly sales trend (last 8 weeks)
  const weekly = await pool.request().query(`
    DECLARE @From DATE = DATEADD(WEEK, -7, CAST(GETDATE() AS DATE));

    ;WITH SalesWeek AS (
      SELECT
        DATEPART(ISO_WEEK, S.SaleDate) AS W,
        YEAR(DATEADD(DAY, 26 - DATEPART(ISO_WEEK, S.SaleDate), S.SaleDate)) AS Y,
        MIN(CAST(S.SaleDate AS DATE)) AS MinD,
        SUM(S.Qty * S.SellingPrice) AS GrossSales
      FROM Sales S
      WHERE CAST(S.SaleDate AS DATE) >= @From
      GROUP BY DATEPART(ISO_WEEK, S.SaleDate),
               YEAR(DATEADD(DAY, 26 - DATEPART(ISO_WEEK, S.SaleDate), S.SaleDate))
    ),
    OrdersWeek AS (
      SELECT
        DATEPART(ISO_WEEK, O.OrderDate) AS W,
        YEAR(DATEADD(DAY, 26 - DATEPART(ISO_WEEK, O.OrderDate), O.OrderDate)) AS Y,
        SUM(ISNULL(O.Discount,0)) AS DiscountAmt,
        SUM(ISNULL(O.DeliveryFee,0)) AS DeliveryAmt
      FROM Orders O
      WHERE CAST(O.OrderDate AS DATE) >= @From
        AND O.PaymentStatus IN ('Paid', 'Completed')
      GROUP BY DATEPART(ISO_WEEK, O.OrderDate),
               YEAR(DATEADD(DAY, 26 - DATEPART(ISO_WEEK, O.OrderDate), O.OrderDate))
    )
    SELECT
      'W' + CAST(COALESCE(SW.W, OW.W) AS VARCHAR) AS week,
      ISNULL(SW.GrossSales,0) - ISNULL(OW.DiscountAmt,0) + ISNULL(OW.DeliveryAmt,0) AS sales
    FROM SalesWeek SW
    FULL OUTER JOIN OrdersWeek OW ON SW.W = OW.W AND SW.Y = OW.Y
    ORDER BY ISNULL(SW.MinD, GETDATE())
  `);

  // Top 10 selling products (this month by qty)
  const topProducts = await pool.request().query(`
    DECLARE @MonthStart DATE = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);

    SELECT TOP 10
      P.Name AS name,
      SUM(S.Qty) AS qty,
      SUM(S.Qty * S.SellingPrice) AS revenue
    FROM Sales S
    JOIN ProductVariants V ON S.VariantId = V.Id
    JOIN Products P ON V.ProductId = P.Id
    WHERE CAST(S.SaleDate AS DATE) >= @MonthStart
    GROUP BY P.Name
    ORDER BY SUM(S.Qty) DESC
  `);

  // Revenue by category (this month)
  const revenueByCategory = await pool.request().query(`
    DECLARE @MonthStart DATE = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);

    SELECT
      C.Name AS name,
      SUM(S.Qty * S.SellingPrice) AS revenue
    FROM Sales S
    JOIN ProductVariants V ON S.VariantId = V.Id
    JOIN Products P ON V.ProductId = P.Id
    JOIN Categories C ON P.CategoryId = C.Id
    WHERE CAST(S.SaleDate AS DATE) >= @MonthStart
    GROUP BY C.Name
    ORDER BY SUM(S.Qty * S.SellingPrice) DESC
  `);

  // Orders by payment status (this month)
  const ordersByStatus = await pool.request().query(`
    DECLARE @MonthStart DATE = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);

    SELECT
      PaymentStatus AS name,
      COUNT(*) AS count
    FROM Orders
    WHERE OrderDate >= @MonthStart
    GROUP BY PaymentStatus
    ORDER BY COUNT(*) DESC
  `);

  return {
    weekly: weekly.recordset,
    topProducts: topProducts.recordset,
    revenueByCategory: revenueByCategory.recordset,
    ordersByStatus: ordersByStatus.recordset,
  };
}