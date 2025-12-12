"use server";

import { getDb } from "@/lib/db";
import sql from "mssql";

export async function getLookups() {
  const pool = await getDb();
  const cats = await pool.request().query(`SELECT Id, Name FROM Categories ORDER BY Name`);
  return { categories: cats.recordset };
}

export async function getProductsByCategory(categoryId: string) {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("catId", sql.UniqueIdentifier, categoryId)
    .query(`SELECT Id, Name FROM Products WHERE CategoryId=@catId ORDER BY Name`);
  return res.recordset;
}

export async function getSizes(productId: string) {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", sql.UniqueIdentifier, productId)
    .query(`
      SELECT DISTINCT s.Id, s.Name
      FROM ProductVariants v
      JOIN Sizes s ON s.Id = v.SizeId
      WHERE v.ProductId=@pid
      ORDER BY s.Name
    `);
  return res.recordset;
}

export async function getVariantsByProductAndSize(productId: string, sizeId: string) {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", sql.UniqueIdentifier, productId)
    .input("sid", sql.UniqueIdentifier, sizeId)
    .query(`
      SELECT v.Id, c.Name AS Color, s.Name AS Size, v.Qty, 
             ISNULL(v.SellingPrice, p.SellingPrice) AS SellingPrice
      FROM ProductVariants v
      JOIN Colors c ON c.Id = v.ColorId
      JOIN Sizes s ON s.Id = v.SizeId
      JOIN Products p ON p.Id = v.ProductId
      WHERE v.ProductId=@pid AND v.SizeId=@sid
      ORDER BY c.Name
    `);
  return res.recordset;
}

export async function sellStock(variantId: string, qty: number, sellingPrice: number) {
  const pool = await getDb();
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    // check stock
    const check = await tx
      .request()
      .input("vid", sql.UniqueIdentifier, variantId)
      .query(`SELECT Qty FROM ProductVariants WHERE Id=@vid`);
    if (check.recordset.length === 0) throw new Error("Variant not found");
    if (check.recordset[0].Qty < qty) throw new Error("Not enough stock");

    // insert sale
    await tx
      .request()
      .input("vid", sql.UniqueIdentifier, variantId)
      .input("qty", sql.Int, qty)
      .input("price", sql.Decimal(18, 2), sellingPrice)
      .query(`
        INSERT INTO Sales (VariantId, Qty, SellingPrice) 
        VALUES (@vid, @qty, @price)
      `);

    // reduce stock
    await tx
      .request()
      .input("vid", sql.UniqueIdentifier, variantId)
      .input("qty", sql.Int, qty)
      .query(`
        UPDATE ProductVariants 
        SET Qty = Qty - @qty
        WHERE Id=@vid
      `);

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function recordBackfill(
  productId: string,
  date: string,
  qty: number,
  cost: number,
  selling: number
) {
  const pool = await getDb();

  // ensure hidden variant exists
  const hidden = await pool.request().input("pid", sql.UniqueIdentifier, productId).query(`
    SELECT TOP 1 v.Id
    FROM ProductVariants v
    WHERE v.ProductId=@pid
      AND v.SizeId IS NULL
      AND v.ColorId IS NULL
  `);

  let variantId = hidden.recordset[0]?.Id;
  if (!variantId) {
    const ins = await pool
      .request()
      .input("pid", sql.UniqueIdentifier, productId)
      .query(`INSERT INTO ProductVariants (ProductId, SizeId, ColorId, Qty) VALUES (@pid, NULL, NULL, 0);
              SELECT SCOPE_IDENTITY() as Id;`);
    variantId = ins.recordset[0].Id;
  }

  // Insert a backfill "sale" (does not touch stock, only records history)
  await pool
    .request()
    .input("vid", sql.UniqueIdentifier, variantId)
    .input("qty", sql.Int, qty)
    .input("price", sql.Decimal(18, 2), selling)
    .input("date", sql.DateTime2, date)
    .query(`
      INSERT INTO Sales (VariantId, Qty, SellingPrice, SaleDate, PaymentMethod, PaymentStatus)
      VALUES (@vid, @qty, @price, @date, 'backfill', 'Paid')
    `);
}
