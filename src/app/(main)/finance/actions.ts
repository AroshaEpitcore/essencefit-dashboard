"use server";

import { getDb } from "@/lib/db";

/**
 * ✅ Finance Summary MUST match Dashboard logic:
 * NetSales = GrossSales - OrderDiscount + DeliveryFee
 * Remaining = NetSales - HandedOver - CashUsed
 */
export async function getFinanceSummary() {
  const pool = await getDb();

  const res = await pool.request().query(`
    ;WITH SalesAgg AS (
      SELECT
        CAST(S.SaleDate AS DATE) AS D,
        SUM(S.Qty * S.SellingPrice) AS GrossSales
      FROM Sales S
      GROUP BY CAST(S.SaleDate AS DATE)
    ),
    OrdersAgg AS (
      SELECT
        CAST(O.OrderDate AS DATE) AS D,
        SUM(ISNULL(O.Discount,0)) AS OrderDiscount,
        SUM(ISNULL(O.DeliveryFee,0)) AS DeliveryFee
      FROM Orders O
      GROUP BY CAST(O.OrderDate AS DATE)
    ),
    DayJoin AS (
      SELECT
        COALESCE(SA.D, OA.D) AS D,
        ISNULL(SA.GrossSales,0) AS GrossSales,
        ISNULL(OA.OrderDiscount,0) AS OrderDiscount,
        ISNULL(OA.DeliveryFee,0) AS DeliveryFee
      FROM SalesAgg SA
      FULL OUTER JOIN OrdersAgg OA ON SA.D = OA.D
    )
    SELECT
      /* ✅ Same as dashboard AllTimeSales */
      CAST(ISNULL(SUM(GrossSales - OrderDiscount + DeliveryFee), 0) AS DECIMAL(18,2)) AS TotalSales,

      /* Handovers & Cash Usage */
      CAST(ISNULL((SELECT SUM(Amount) FROM Handovers), 0) AS DECIMAL(18,2)) AS HandedOver,
      CAST(ISNULL((SELECT SUM(Amount) FROM CashUsage), 0) AS DECIMAL(18,2)) AS CashUsed,

      /* ✅ Remaining Balance */
      CAST(
        ISNULL(SUM(GrossSales - OrderDiscount + DeliveryFee), 0)
        - ISNULL((SELECT SUM(Amount) FROM Handovers), 0)
        - ISNULL((SELECT SUM(Amount) FROM CashUsage), 0)
      AS DECIMAL(18,2)) AS Remaining
    FROM DayJoin
  `);

  return res.recordset[0];
}

/**
 * NOTE:
 * This is still "gross profit by product" from Sales table.
 * (Order-level Discount/Delivery are stored in Orders, not per-product,
 * so we cannot allocate accurately without an OrderId link in Sales or OrderItems table.)
 */
export async function getProductProfit() {
  const pool = await getDb();
  const result = await pool.request().query(`
    SELECT 
      P.Id AS ProductId,
      P.Name AS ProductName,
      SUM(S.Qty) AS TotalSoldQty,
      CAST(SUM(S.Qty * S.SellingPrice) AS DECIMAL(18,2)) AS TotalRevenue,
      CAST(SUM(S.Qty * P.CostPrice) AS DECIMAL(18,2)) AS TotalCost,
      CAST(SUM((S.Qty * S.SellingPrice) - (S.Qty * P.CostPrice)) AS DECIMAL(18,2)) AS Profit
    FROM Sales S
    JOIN ProductVariants V ON S.VariantId = V.Id
    JOIN Products P ON V.ProductId = P.Id
    GROUP BY P.Id, P.Name
    ORDER BY P.Name
  `);
  return result.recordset;
}

export async function recordHandover(userId: string, amount: number) {
  const pool = await getDb();
  const result = await pool
    .request()
    .input("userId", userId)
    .input("amount", amount)
    .query(`
      INSERT INTO Handovers (UserId, Amount)
      OUTPUT INSERTED.Id, INSERTED.Amount, INSERTED.HandoverDate
      VALUES (@userId, @amount)
    `);
  return result.recordset[0];
}

export async function recordCashUsage(reason: string, amount: number) {
  const pool = await getDb();
  const result = await pool
    .request()
    .input("desc", reason)
    .input("amount", amount)
    .query(`
      INSERT INTO CashUsage (Description, Amount)
      OUTPUT INSERTED.Id, INSERTED.Description, INSERTED.Amount, INSERTED.UsageDate
      VALUES (@desc, @amount)
    `);
  return result.recordset[0];
}

/** ✅ UI expects h.ManagerName, so return ManagerName */
export async function getRecentHandovers() {
  const pool = await getDb();
  const result = await pool.request().query(`
    SELECT TOP 10 
      Id, 
      Amount, 
      HandoverDate, 
      UserId,
      UserId AS ManagerName
    FROM Handovers
    ORDER BY HandoverDate DESC
  `);
  return result.recordset;
}

export async function getRecentCashUsages() {
  const pool = await getDb();
  const result = await pool.request().query(`
    SELECT TOP 10 Id, Description, Amount, UsageDate
    FROM CashUsage
    ORDER BY UsageDate DESC
  `);
  return result.recordset;
}
