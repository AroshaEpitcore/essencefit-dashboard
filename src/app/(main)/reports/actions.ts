"use server";

import { getDb } from "@/lib/db";
import { sortBySize } from "@/lib/sizeOrder";

/** Load Categories */
export async function getCategories() {
  const pool = await getDb();
  const result = await pool.request().query(`
    SELECT Id, Name
    FROM Categories
    ORDER BY Name
  `);
  return result.recordset as Array<{ Id: string; Name: string }>;
}

/** Load Products; optionally filter by CategoryId */
export async function getProducts(categoryId?: string) {
  const pool = await getDb();
  const req = pool.request();

  let sql = `
    SELECT Id, Name, CategoryId
    FROM Products
  `;

  if (categoryId) {
    sql += ` WHERE CategoryId = @catId`;
    req.input("catId", categoryId);
  }

  sql += ` ORDER BY Name`;

  const result = await req.query(sql);
  return result.recordset as Array<{ Id: string; Name: string; CategoryId: string }>;
}

/** Load Sizes */
export async function getSizes() {
  const pool = await getDb();
  const result = await pool.request().query(`
    SELECT Id, Name
    FROM Sizes
    ORDER BY Name
  `);
  return sortBySize(result.recordset as Array<{ Id: string; Name: string }>, (s) => s.Name);
}

/** Load Colors */
export async function getColors() {
  const pool = await getDb();
  const result = await pool.request().query(`
    SELECT Id, Name
    FROM Colors
    ORDER BY Name
  `);
  return result.recordset as Array<{ Id: string; Name: string }>;
}

/** Inventory report */
export async function runInventoryReport(filters: any) {
  const pool = await getDb();
  const result = await pool
    .request()
    .input("CategoryId", filters.category || null)
    .input("ProductId", filters.product || null)
    .input("SizeId", filters.size || null)
    .input("ColorId", filters.color || null)
    .query(`
      SELECT 
        C.Name AS Category, 
        P.Name AS Product, 
        S.Name AS Size, 
        Cl.Name AS Color, 
        V.Qty
      FROM ProductVariants V
      JOIN Products P ON V.ProductId = P.Id
      JOIN Categories C ON P.CategoryId = C.Id
      LEFT JOIN Sizes S ON V.SizeId = S.Id
      LEFT JOIN Colors Cl ON V.ColorId = Cl.Id
      WHERE (@CategoryId IS NULL OR P.CategoryId = @CategoryId)
        AND (@ProductId IS NULL OR P.Id = @ProductId)
        AND (@SizeId IS NULL OR V.SizeId = @SizeId)
        AND (@ColorId IS NULL OR V.ColorId = @ColorId)
    `);
  return result.recordset;
}

/**
 * ✅ Sales Report (NET) — matches Dashboard/Finance:
 * Net = Gross - OrderDiscount + DeliveryFee
 *
 * Since Sales table doesn't link to OrderId, we allocate day adjustments
 * proportionally across products by their gross share per day.
 */
export async function runSalesReport(filters: any) {
  const pool = await getDb();

  const result = await pool
    .request()
    .input("CategoryId", filters.category || null)
    .input("ProductId", filters.product || null)
    .input("From", filters.from || null)
    .input("To", filters.to || null)
    .query(`

      WITH SalesByProdDay AS (
        SELECT
          CAST(S.SaleDate AS DATE) AS D,
          P.Id AS ProductId,
          P.Name AS Product,
          SUM(S.Qty) AS Qty,
          SUM(S.Qty * S.SellingPrice) AS GrossRevenue
        FROM Sales S
        JOIN ProductVariants V ON S.VariantId = V.Id
        JOIN Products P ON V.ProductId = P.Id
        WHERE (@CategoryId IS NULL OR P.CategoryId = @CategoryId)
          AND (@ProductId IS NULL OR P.Id = @ProductId)
          AND ((@From)::date IS NULL OR CAST(S.SaleDate AS DATE) >= (@From)::date)
          AND ((@To)::date IS NULL OR CAST(S.SaleDate AS DATE) <= (@To)::date)
        GROUP BY CAST(S.SaleDate AS DATE), P.Id, P.Name
      ),
      DayGross AS (
        SELECT D, SUM(GrossRevenue) AS DayGrossRevenue
        FROM SalesByProdDay
        GROUP BY D
      ),
      OrdersByDay AS (
        SELECT
          CAST(O.OrderDate AS DATE) AS D,
          SUM(COALESCE(O.Discount,0)) AS DayDiscount,
          SUM(COALESCE(O.DeliveryFee,0)) AS DayDeliveryFee
        FROM Orders O
        WHERE O.PaymentStatus IN ('Paid', 'Completed')
          AND ((@From)::date IS NULL OR CAST(O.OrderDate AS DATE) >= (@From)::date)
          AND ((@To)::date IS NULL OR CAST(O.OrderDate AS DATE) <= (@To)::date)
        GROUP BY CAST(O.OrderDate AS DATE)
      ),
      DayAdjust AS (
        SELECT
          COALESCE(G.D, O.D) AS D,
          COALESCE(G.DayGrossRevenue,0) AS DayGrossRevenue,
          COALESCE(O.DayDiscount,0) AS DayDiscount,
          COALESCE(O.DayDeliveryFee,0) AS DayDeliveryFee,
          (0 - COALESCE(O.DayDiscount,0) + COALESCE(O.DayDeliveryFee,0)) AS DayAdjustment
        FROM DayGross G
        FULL OUTER JOIN OrdersByDay O ON G.D = O.D
      ),
      SalesNetAllocated AS (
        SELECT
          S.Product,
          S.Qty,
          /* Allocate adjustment by gross share */
          CAST(
            S.GrossRevenue
            + CASE 
                WHEN COALESCE(D.DayGrossRevenue,0) = 0 THEN 0
                ELSE (S.GrossRevenue / D.DayGrossRevenue) * COALESCE(D.DayAdjustment,0)
              END
          AS DECIMAL(18,2)) AS NetRevenue
        FROM SalesByProdDay S
        JOIN DayAdjust D ON D.D = S.D
      )
      SELECT
        Product,
        SUM(Qty) AS Qty,
        CAST(SUM(NetRevenue) AS DECIMAL(18,2)) AS Revenue
      FROM SalesNetAllocated
      GROUP BY Product
      ORDER BY Product
    `);

  return result.recordset;
}

/**
 * ✅ Expenses report (same as before)
 */
export async function runExpensesReport(filters: any) {
  const pool = await getDb();
  const result = await pool
    .request()
    .input("From", filters.from || null)
    .input("To", filters.to || null)
    .query(`

      SELECT Category, Description, Amount, ExpenseDate
      FROM Expenses
      WHERE ((@From)::date IS NULL OR CAST(ExpenseDate AS DATE) >= (@From)::date)
        AND ((@To)::date IS NULL OR CAST(ExpenseDate AS DATE) <= (@To)::date)
      ORDER BY ExpenseDate DESC
    `);
  return result.recordset;
}

/**
 * ✅ P&L (NET Revenue) — matches Dashboard/Finance totals:
 * Revenue = SUM(GrossSales - Discount + DeliveryFee) (by day)
 * COGS = SUM(SalesQty * CostPrice)
 * GrossProfit = Revenue - COGS
 */
export async function runPnLReport(from?: string, to?: string) {
  const pool = await getDb();
  const result = await pool
    .request()
    .input("From", from || null)
    .input("To", to || null)
    .query(`

      WITH SalesAgg AS (
        SELECT
          CAST(S.SaleDate AS DATE) AS D,
          SUM(S.Qty * S.SellingPrice) AS GrossSales,
          SUM(S.Qty * S.CostPrice) AS COGS
        FROM Sales S
        WHERE ((@From)::date IS NULL OR CAST(S.SaleDate AS DATE) >= (@From)::date)
          AND ((@To)::date IS NULL OR CAST(S.SaleDate AS DATE) <= (@To)::date)
        GROUP BY CAST(S.SaleDate AS DATE)
      ),
      OrdersAgg AS (
        SELECT
          CAST(O.OrderDate AS DATE) AS D,
          SUM(COALESCE(O.Discount,0)) AS OrderDiscount,
          SUM(COALESCE(O.DeliveryFee,0)) AS DeliveryFee
        FROM Orders O
        WHERE O.PaymentStatus IN ('Paid', 'Completed')
          AND ((@From)::date IS NULL OR CAST(O.OrderDate AS DATE) >= (@From)::date)
          AND ((@To)::date IS NULL OR CAST(O.OrderDate AS DATE) <= (@To)::date)
        GROUP BY CAST(O.OrderDate AS DATE)
      ),
      DayJoin AS (
        SELECT
          COALESCE(SA.D, OA.D) AS D,
          COALESCE(SA.GrossSales,0) AS GrossSales,
          COALESCE(SA.COGS,0) AS COGS,
          COALESCE(OA.OrderDiscount,0) AS OrderDiscount,
          COALESCE(OA.DeliveryFee,0) AS DeliveryFee
        FROM SalesAgg SA
        FULL OUTER JOIN OrdersAgg OA ON SA.D = OA.D
      )
      SELECT
        CAST(COALESCE(SUM(GrossSales - OrderDiscount + DeliveryFee),0) AS DECIMAL(18,2)) AS Revenue,
        CAST(COALESCE(SUM(COGS),0) AS DECIMAL(18,2)) AS COGS,
        CAST(
          COALESCE(SUM(GrossSales - OrderDiscount + DeliveryFee),0) - COALESCE(SUM(COGS),0)
        AS DECIMAL(18,2)) AS GrossProfit
      FROM DayJoin
    `);

  return result.recordset[0];
}

/** Dead Stock */
export async function runDeadStockReport(filters: any) {
  const pool = await getDb();
  const result = await pool
    .request()
    .input("CategoryId", filters.category || null)
    .input("ProductId", filters.product || null)
    .query(`
      SELECT P.Name AS Product, V.Qty
      FROM ProductVariants V
      JOIN Products P ON V.ProductId = P.Id
      WHERE V.Qty = 0
        AND (@CategoryId IS NULL OR P.CategoryId = @CategoryId)
        AND (@ProductId IS NULL OR P.Id = @ProductId)
      ORDER BY P.Name
    `);
  return result.recordset;
}

/**
 * ✅ Top 10 Colors Report (NET Revenue with day-level adjustments)
 * Shows best-selling colors ranked by quantity sold
 */
export async function runTopColorsReport(filters: any) {
  const pool = await getDb();
  const result = await pool
    .request()
    .input("CategoryId", filters.category || null)
    .input("ProductId", filters.product || null)
    .input("From", filters.from || null)
    .input("To", filters.to || null)
    .query(`

      WITH SalesByColorDay AS (
        SELECT
          CAST(S.SaleDate AS DATE) AS D,
          COALESCE(Cl.Name, 'No Color') AS Color,
          SUM(S.Qty) AS Qty,
          SUM(S.Qty * S.SellingPrice) AS GrossRevenue
        FROM Sales S
        JOIN ProductVariants V ON S.VariantId = V.Id
        JOIN Products P ON V.ProductId = P.Id
        LEFT JOIN Colors Cl ON V.ColorId = Cl.Id
        WHERE (@CategoryId IS NULL OR P.CategoryId = @CategoryId)
          AND (@ProductId IS NULL OR P.Id = @ProductId)
          AND ((@From)::date IS NULL OR CAST(S.SaleDate AS DATE) >= (@From)::date)
          AND ((@To)::date IS NULL OR CAST(S.SaleDate AS DATE) <= (@To)::date)
        GROUP BY CAST(S.SaleDate AS DATE), COALESCE(Cl.Name, 'No Color')
      ),
      DayGross AS (
        SELECT D, SUM(GrossRevenue) AS DayGrossRevenue
        FROM SalesByColorDay
        GROUP BY D
      ),
      OrdersByDay AS (
        SELECT
          CAST(O.OrderDate AS DATE) AS D,
          SUM(COALESCE(O.Discount,0)) AS DayDiscount,
          SUM(COALESCE(O.DeliveryFee,0)) AS DayDeliveryFee
        FROM Orders O
        WHERE O.PaymentStatus IN ('Paid', 'Completed')
          AND ((@From)::date IS NULL OR CAST(O.OrderDate AS DATE) >= (@From)::date)
          AND ((@To)::date IS NULL OR CAST(O.OrderDate AS DATE) <= (@To)::date)
        GROUP BY CAST(O.OrderDate AS DATE)
      ),
      DayAdjust AS (
        SELECT
          COALESCE(G.D, O.D) AS D,
          COALESCE(G.DayGrossRevenue,0) AS DayGrossRevenue,
          COALESCE(O.DayDiscount,0) AS DayDiscount,
          COALESCE(O.DayDeliveryFee,0) AS DayDeliveryFee,
          (0 - COALESCE(O.DayDiscount,0) + COALESCE(O.DayDeliveryFee,0)) AS DayAdjustment
        FROM DayGross G
        FULL OUTER JOIN OrdersByDay O ON G.D = O.D
      ),
      SalesNetAllocated AS (
        SELECT
          S.Color,
          S.Qty,
          CAST(
            S.GrossRevenue
            + CASE 
                WHEN COALESCE(D.DayGrossRevenue,0) = 0 THEN 0
                ELSE (S.GrossRevenue / D.DayGrossRevenue) * COALESCE(D.DayAdjustment,0)
              END
          AS DECIMAL(18,2)) AS NetRevenue
        FROM SalesByColorDay S
        LEFT JOIN DayAdjust D ON D.D = S.D
      )
      SELECT Color,
        SUM(Qty) AS Qty,
        CAST(SUM(NetRevenue) AS DECIMAL(18,2)) AS Revenue
      FROM SalesNetAllocated
      GROUP BY Color
      ORDER BY SUM(Qty) DESC LIMIT 10
    `);

  return result.recordset;
}