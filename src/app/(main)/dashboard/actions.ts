"use server";

import { getDb } from "@/lib/db";

export async function getDashboardStats() {
  const pool = await getDb();

  const result = await pool.request().query(`
    /* ---------------- Aggregates from Sales ---------------- */
    WITH SalesAgg AS (
      SELECT
        CAST(S.SaleDate AS DATE) AS D,
        SUM(S.Qty * S.SellingPrice) AS GrossSales,
        SUM(S.Qty) AS UnitsSold,
        SUM(S.Qty * S.CostPrice) AS Cogs
      FROM Sales S
      GROUP BY CAST(S.SaleDate AS DATE)
    ),
    OrdersAgg AS (
      SELECT
        CAST(O.OrderDate AS DATE) AS D,
        SUM(COALESCE(O.Discount,0)) AS OrderDiscount,
        SUM(COALESCE(O.DeliveryFee,0)) AS DeliveryFee
      FROM Orders O
      WHERE O.PaymentStatus IN ('Paid', 'Completed')
      GROUP BY CAST(O.OrderDate AS DATE)
    ),
    DayJoin AS (
      SELECT
        COALESCE(SA.D, OA.D) AS D,
        COALESCE(SA.GrossSales,0) AS GrossSales,
        COALESCE(SA.UnitsSold,0) AS UnitsSold,
        COALESCE(SA.Cogs,0) AS Cogs,
        COALESCE(OA.OrderDiscount,0) AS OrderDiscount,
        COALESCE(OA.DeliveryFee,0) AS DeliveryFee
      FROM SalesAgg SA
      FULL OUTER JOIN OrdersAgg OA ON SA.D = OA.D
    )
    SELECT
      (SELECT COALESCE(SUM(Qty),0) FROM ProductVariants) AS TotalStock,

      (SELECT COALESCE(SUM(GrossSales - OrderDiscount + DeliveryFee),0)
       FROM DayJoin
       WHERE D = current_date) AS TodaysSales,

      (SELECT COALESCE(SUM(GrossSales - OrderDiscount + DeliveryFee),0)
       FROM DayJoin
       WHERE D >= date_trunc('month', current_date)::date) AS ThisMonthSales,

      (SELECT COALESCE(SUM((GrossSales - Cogs) - OrderDiscount + DeliveryFee),0)
       FROM DayJoin
       WHERE D >= date_trunc('month', current_date)::date) AS ThisMonthProfit,

      (SELECT COALESCE(SUM(UnitsSold),0)
       FROM DayJoin
       WHERE D = current_date) AS UnitsSoldToday,

      (SELECT COALESCE(SUM(UnitsSold),0)
       FROM DayJoin
       WHERE D >= date_trunc('month', current_date)::date) AS UnitsSoldMonth,

      (SELECT COALESCE(SUM(UnitsSold),0)
       FROM DayJoin) AS AllTimeUnitsSold,

      (SELECT COALESCE(SUM(E.Amount),0)
       FROM Expenses E
       WHERE E.ExpenseDate >= date_trunc('month', current_date)::date) AS ExpensesMonth,

      (
        (SELECT COALESCE(SUM((GrossSales - Cogs) - OrderDiscount + DeliveryFee),0)
         FROM DayJoin
         WHERE D >= date_trunc('month', current_date)::date)
        - COALESCE((SELECT SUM(E.Amount) FROM Expenses E WHERE E.ExpenseDate >= date_trunc('month', current_date)::date),0)
      ) AS ThisMonthNet,

      (SELECT COALESCE(SUM(GrossSales - OrderDiscount + DeliveryFee),0) FROM DayJoin) AS AllTimeSales,

      (SELECT COALESCE(SUM((GrossSales - Cogs) - OrderDiscount + DeliveryFee),0) FROM DayJoin) AS AllTimeProfit,

      (SELECT COUNT(*) FROM Products) AS Products,
      (SELECT COUNT(*) FROM ProductVariants) AS Variants,
      (SELECT COUNT(*) FROM ProductVariants WHERE Qty < 5) AS LowStock,

      (SELECT COUNT(*) FROM Orders WHERE CAST(OrderDate AS DATE) = current_date) AS OrdersToday,
      (SELECT COUNT(*) FROM Orders WHERE OrderDate >= date_trunc('month', current_date)::date) AS OrdersMonth,

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
    WITH SalesMonth AS (
      SELECT
        to_char(S.SaleDate, 'Mon YYYY') AS M,
        MIN(S.SaleDate) AS MinD,
        SUM(S.Qty * S.SellingPrice) AS GrossSales,
        SUM(S.Qty * S.CostPrice) AS Cogs
      FROM Sales S
      GROUP BY to_char(S.SaleDate, 'Mon YYYY')
    ),
    OrdersMonth AS (
      SELECT
        to_char(O.OrderDate, 'Mon YYYY') AS M,
        SUM(COALESCE(O.Discount,0)) AS DiscountAmt,
        SUM(COALESCE(O.DeliveryFee,0)) AS DeliveryAmt
      FROM Orders O
      WHERE O.PaymentStatus IN ('Paid', 'Completed')
      GROUP BY to_char(O.OrderDate, 'Mon YYYY')
    )
    SELECT COALESCE(SM.M, OM.M) AS month,
      COALESCE(SM.GrossSales,0) - COALESCE(OM.DiscountAmt,0) + COALESCE(OM.DeliveryAmt,0) AS sales,
      (COALESCE(SM.GrossSales,0) - COALESCE(SM.Cogs,0)) - COALESCE(OM.DiscountAmt,0) + COALESCE(OM.DeliveryAmt,0) AS profit
    FROM SalesMonth SM
    FULL OUTER JOIN OrdersMonth OM ON SM.M = OM.M
    ORDER BY COALESCE(SM.MinD, now()) LIMIT 6
  `);

  // ✅ Daily (Net) Sales last 14 days
  const daily = await pool.request().query(`
    WITH SalesDay AS (
      SELECT
        CAST(S.SaleDate AS DATE) AS D,
        SUM(S.Qty * S.SellingPrice) AS GrossSales
      FROM Sales S
      WHERE CAST(S.SaleDate AS DATE) >= (current_date - 13)
      GROUP BY CAST(S.SaleDate AS DATE)
    ),
    OrdersDay AS (
      SELECT
        CAST(O.OrderDate AS DATE) AS D,
        SUM(COALESCE(O.Discount,0)) AS DiscountAmt,
        SUM(COALESCE(O.DeliveryFee,0)) AS DeliveryAmt
      FROM Orders O
      WHERE CAST(O.OrderDate AS DATE) >= (current_date - 13)
        AND O.PaymentStatus IN ('Paid', 'Completed')
      GROUP BY CAST(O.OrderDate AS DATE)
    )
    SELECT COALESCE(SD.D, OD.D)::text AS date,
      COALESCE(SD.GrossSales,0) - COALESCE(OD.DiscountAmt,0) + COALESCE(OD.DeliveryAmt,0) AS sales
    FROM SalesDay SD
    FULL OUTER JOIN OrdersDay OD ON SD.D = OD.D
    ORDER BY COALESCE(SD.D, OD.D) DESC LIMIT 14
  `);

  return { monthly: monthly.recordset, daily: daily.recordset };
}

export async function getAnalyticsData() {
  const pool = await getDb();

  // Weekly sales trend (last 8 weeks)
  const weekly = await pool.request().query(`
    WITH SalesWeek AS (
      SELECT
        extract(week from S.SaleDate) AS W,
        extract(isoyear from S.SaleDate) AS Y,
        MIN(CAST(S.SaleDate AS DATE)) AS MinD,
        SUM(S.Qty * S.SellingPrice) AS GrossSales
      FROM Sales S
      WHERE CAST(S.SaleDate AS DATE) >= (current_date - interval '7 weeks')::date
      GROUP BY extract(week from S.SaleDate), extract(isoyear from S.SaleDate)
    ),
    OrdersWeek AS (
      SELECT
        extract(week from O.OrderDate) AS W,
        extract(isoyear from O.OrderDate) AS Y,
        SUM(COALESCE(O.Discount,0)) AS DiscountAmt,
        SUM(COALESCE(O.DeliveryFee,0)) AS DeliveryAmt
      FROM Orders O
      WHERE CAST(O.OrderDate AS DATE) >= (current_date - interval '7 weeks')::date
        AND O.PaymentStatus IN ('Paid', 'Completed')
      GROUP BY extract(week from O.OrderDate), extract(isoyear from O.OrderDate)
    )
    SELECT
      'W' || COALESCE(SW.W, OW.W)::text AS week,
      COALESCE(SW.GrossSales,0) - COALESCE(OW.DiscountAmt,0) + COALESCE(OW.DeliveryAmt,0) AS sales
    FROM SalesWeek SW
    FULL OUTER JOIN OrdersWeek OW ON SW.W = OW.W AND SW.Y = OW.Y
    ORDER BY COALESCE(SW.MinD, now())
  `);

  // Top 10 selling products (this month by qty)
  const topProducts = await pool.request().query(`
    SELECT P.Name AS name,
      SUM(S.Qty) AS qty,
      SUM(S.Qty * S.SellingPrice) AS revenue
    FROM Sales S
    JOIN ProductVariants V ON S.VariantId = V.Id
    JOIN Products P ON V.ProductId = P.Id
    WHERE CAST(S.SaleDate AS DATE) >= date_trunc('month', current_date)::date
    GROUP BY P.Name
    ORDER BY SUM(S.Qty) DESC LIMIT 10
  `);

  // Revenue by category (this month)
  const revenueByCategory = await pool.request().query(`
    SELECT
      C.Name AS name,
      SUM(S.Qty * S.SellingPrice) AS revenue
    FROM Sales S
    JOIN ProductVariants V ON S.VariantId = V.Id
    JOIN Products P ON V.ProductId = P.Id
    JOIN Categories C ON P.CategoryId = C.Id
    WHERE CAST(S.SaleDate AS DATE) >= date_trunc('month', current_date)::date
    GROUP BY C.Name
    ORDER BY SUM(S.Qty * S.SellingPrice) DESC
  `);

  // Orders by payment status (this month)
  const ordersByStatus = await pool.request().query(`
    SELECT
      PaymentStatus AS name,
      COUNT(*) AS count
    FROM Orders
    WHERE OrderDate >= date_trunc('month', current_date)::date
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
