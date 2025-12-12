"use server";

import { getDb } from "@/lib/db";

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

/** Load Sizes (from Sizes table) */
export async function getSizes() {
  const pool = await getDb();
  const result = await pool.request().query(`
    SELECT Id, Name
    FROM Sizes
    ORDER BY Name
  `);
  return result.recordset as Array<{ Id: string; Name: string }>;
}

/** Load Colors (from Colors table) */
export async function getColors() {
  const pool = await getDb();
  const result = await pool.request().query(`
    SELECT Id, Name
    FROM Colors
    ORDER BY Name
  `);
  return result.recordset as Array<{ Id: string; Name: string }>;
}

/** Sales report */
// Inventory
export async function runInventoryReport(filters: any) {
  const pool = await getDb();
  const result = await pool
    .request()
    .input("CategoryId", filters.category || null)
    .input("ProductId", filters.product || null)
    .input("SizeId", filters.size || null)
    .input("ColorId", filters.color || null)
    .query(`
      SELECT C.Name AS Category, P.Name AS Product, S.Name AS Size, Cl.Name AS Color, V.Qty
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

// Sales
export async function runSalesReport(filters: any) {
  const pool = await getDb();
  const result = await pool
    .request()
    .input("CategoryId", filters.category || null)
    .input("ProductId", filters.product || null)
    .input("From", filters.from || null)
    .input("To", filters.to || null)
    .query(`
      SELECT P.Name AS Product, SUM(S.Qty) AS Qty, SUM(S.Qty * S.SellingPrice) AS Revenue
      FROM Sales S
      JOIN ProductVariants V ON S.VariantId = V.Id
      JOIN Products P ON V.ProductId = P.Id
      WHERE (@CategoryId IS NULL OR P.CategoryId = @CategoryId)
      AND (@ProductId IS NULL OR P.Id = @ProductId)
      AND (@From IS NULL OR S.SaleDate >= @From)
      AND (@To IS NULL OR S.SaleDate <= @To)
      GROUP BY P.Name
    `);
  return result.recordset;
}

// Expenses
export async function runExpensesReport(filters: any) {
  const pool = await getDb();
  const result = await pool
    .request()
    .input("From", filters.from || null)
    .input("To", filters.to || null)
    .query(`
      SELECT Category, Description, Amount, ExpenseDate
      FROM Expenses
      WHERE (@From IS NULL OR ExpenseDate >= @From)
      AND (@To IS NULL OR ExpenseDate <= @To)
      ORDER BY ExpenseDate DESC
    `);
  return result.recordset;
}

// P&L
export async function runPnLReport(from?: string, to?: string) {
  const pool = await getDb();
  const result = await pool
    .request()
    .input("From", from || null)
    .input("To", to || null)
    .query(`
      SELECT 
        SUM(S.Qty * S.SellingPrice) AS Revenue,
        SUM(S.Qty * P.CostPrice) AS COGS,
        SUM((S.Qty * S.SellingPrice) - (S.Qty * P.CostPrice)) AS GrossProfit
      FROM Sales S
      JOIN ProductVariants V ON S.VariantId = V.Id
      JOIN Products P ON V.ProductId = P.Id
      WHERE (@From IS NULL OR S.SaleDate >= @From)
      AND (@To IS NULL OR S.SaleDate <= @To)
    `);
  return result.recordset[0];
}

// Dead Stock
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
    `);
  return result.recordset;
}