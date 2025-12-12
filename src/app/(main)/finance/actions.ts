"use server";

import { getDb } from "@/lib/db";

export async function getFinanceSummary() {
  const pool = await getDb();
  const result = await pool.request().query("SELECT * FROM v_FinanceSummary");
  return result.recordset[0];
}

export async function getProductProfit() {
  const pool = await getDb();
  const result = await pool.request().query(`
    SELECT 
      P.Id AS ProductId,
      P.Name AS ProductName,
      SUM(S.Qty) AS TotalSoldQty,
      SUM(S.Qty * S.SellingPrice) AS TotalRevenue,
      SUM(S.Qty * P.CostPrice) AS TotalCost,
      SUM((S.Qty * S.SellingPrice) - (S.Qty * P.CostPrice)) AS Profit
    FROM Sales S
    JOIN ProductVariants V ON S.VariantId = V.Id
    JOIN Products P ON V.ProductId = P.Id
    GROUP BY P.Id, P.Name
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
  return result.recordset[0]; // {Id, Amount, HandoverDate}
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
  return result.recordset[0]; // {Id, Description, Amount, UsageDate}
}

export async function getRecentHandovers() {
  const pool = await getDb();
  const result = await pool.request().query(`
    SELECT TOP 10 Id, Amount, HandoverDate, UserId
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
