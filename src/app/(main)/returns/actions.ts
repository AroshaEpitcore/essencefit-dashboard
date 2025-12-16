"use server";

import { getDb } from "@/lib/db";
import sql from "mssql";

/* ---------- Lookups ---------- */

export async function getCategories() {
  const db = await getDb();
  const res = await db.request().query(`
    SELECT Id, Name FROM Categories ORDER BY Name
  `);
  return res.recordset;
}

export async function getProductsByCategory(categoryId: string) {
  const db = await getDb();
  const res = await db
    .request()
    .input("cat", sql.UniqueIdentifier, categoryId)
    .query(`
      SELECT Id, Name FROM Products WHERE CategoryId=@cat ORDER BY Name
    `);
  return res.recordset;
}

export async function getOrdersForReturn() {
  const db = await getDb();
  const res = await db.request().query(`
    SELECT TOP 50
      Id,
      Customer,
      OrderDate,
      Total
    FROM Orders
    ORDER BY OrderDate DESC
  `);
  return res.recordset;
}

export async function getSizesByProduct(productId: string) {
  const db = await getDb();
  const res = await db
    .request()
    .input("pid", sql.UniqueIdentifier, productId)
    .query(`
      SELECT DISTINCT s.Id, s.Name
      FROM ProductVariants v
      JOIN Sizes s ON v.SizeId = s.Id
      WHERE v.ProductId=@pid
      ORDER BY s.Name
    `);
  return res.recordset;
}

export async function getColorsByProductAndSize(productId: string, sizeId: string) {
  const db = await getDb();
  const res = await db
    .request()
    .input("pid", sql.UniqueIdentifier, productId)
    .input("sid", sql.UniqueIdentifier, sizeId)
    .query(`
      SELECT DISTINCT c.Id, c.Name
      FROM ProductVariants v
      JOIN Colors c ON v.ColorId = c.Id
      WHERE v.ProductId=@pid AND v.SizeId=@sid
      ORDER BY c.Name
    `);
  return res.recordset;
}

export async function getVariant(productId: string, sizeId: string, colorId: string) {
  const db = await getDb();
  const res = await db
    .request()
    .input("pid", sql.UniqueIdentifier, productId)
    .input("sid", sql.UniqueIdentifier, sizeId)
    .input("cid", sql.UniqueIdentifier, colorId)
    .query(`
      SELECT TOP 1 v.Id AS VariantId, v.Qty AS InStock
      FROM ProductVariants v
      WHERE v.ProductId=@pid AND v.SizeId=@sid AND v.ColorId=@cid
    `);
  return res.recordset[0];
}

/* ---------- Sales Returns ---------- */

export async function createSalesReturn(
  orderId: string,
  reason: string,
  items: { VariantId: string; Qty: number }[]
) {
  if (!orderId) throw new Error("OrderId is required");
  if (!items.length) throw new Error("No return items");
  if (!reason?.trim()) throw new Error("Reason is required");

  const db = await getDb();
  const tx = new sql.Transaction(db);

  try {
    await tx.begin();

    // validate order exists
    const check = await new sql.Request(tx)
      .input("OrderId", sql.UniqueIdentifier, orderId)
      .query(`SELECT TOP 1 Id FROM Orders WHERE Id=@OrderId`);

    if (check.recordset.length === 0) {
      throw new Error("Invalid OrderId (order not found)");
    }

    // insert header
    const res = await new sql.Request(tx)
      .input("OrderId", sql.UniqueIdentifier, orderId)
      .input("Reason", sql.NVarChar(500), reason)
      .query(`
        INSERT INTO SalesReturns (OrderId, Reason)
        OUTPUT INSERTED.Id
        VALUES (@OrderId, @Reason)
      `);

    const returnId = res.recordset[0].Id as string;

    // insert items + restock
    for (const it of items) {
      if (!it.VariantId) throw new Error("VariantId missing");
      if (!it.Qty || it.Qty <= 0) throw new Error("Qty must be > 0");

      await new sql.Request(tx)
        .input("ReturnId", sql.UniqueIdentifier, returnId)
        .input("VariantId", sql.UniqueIdentifier, it.VariantId)
        .input("Qty", sql.Int, it.Qty)
        .query(`
          INSERT INTO SalesReturnItems (ReturnId, VariantId, Qty)
          VALUES (@ReturnId, @VariantId, @Qty)
        `);

      await new sql.Request(tx)
        .input("VariantId", sql.UniqueIdentifier, it.VariantId)
        .input("Qty", sql.Int, it.Qty)
        .query(`
          UPDATE ProductVariants
          SET Qty = Qty + @Qty
          WHERE Id=@VariantId
        `);
    }

    await tx.commit();
    return { success: true, returnId };
  } catch (err) {
    try {
      await tx.rollback();
    } catch {}
    throw err;
  }
}

export async function getRecentReturns(limit: number = 10) {
  const db = await getDb();
  const res = await db
    .request()
    .input("n", sql.Int, limit)
    .query(`
      SELECT TOP (@n)
        r.Id,
        r.OrderId,
        r.Reason,
        r.CreatedAt,
        COUNT(ri.Id) AS ItemCount
      FROM SalesReturns r
      LEFT JOIN SalesReturnItems ri ON ri.ReturnId = r.Id
      GROUP BY r.Id, r.OrderId, r.Reason, r.CreatedAt
      ORDER BY r.CreatedAt DESC
    `);
  return res.recordset;
}
