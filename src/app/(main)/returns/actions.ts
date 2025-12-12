"use server";

import { getDb } from "@/lib/db";
import sql from "mssql";

// ✅ Reuse existing lookups (Category → Product → Size → Color → Variant)
export async function getCategories() {
  const db = await getDb();
  const res = await db.request().query("SELECT Id, Name FROM Categories ORDER BY Name");
  return res.recordset;
}

export async function getProductsByCategory(categoryId: string) {
  const db = await getDb();
  const res = await db
    .request()
    .input("cat", sql.UniqueIdentifier, categoryId)
    .query("SELECT Id, Name FROM Products WHERE CategoryId=@cat ORDER BY Name");
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

// ✅ Save Sales Return
export async function createSalesReturn(orderId: string | null, reason: string, items: { VariantId: string; Qty: number }[]) {
  if (!items.length) throw new Error("No return items");

  const db = await getDb();
  const tx = new sql.Transaction(db);

  try {
    await tx.begin();

    const req1 = new sql.Request(tx);
    req1.input("OrderId", sql.UniqueIdentifier, orderId || null);
    req1.input("Reason", sql.NVarChar(500), reason || null);
    const res = await req1.query(`
      INSERT INTO SalesReturns (OrderId, Reason)
      OUTPUT INSERTED.Id
      VALUES (@OrderId, @Reason)
    `);
    const returnId = res.recordset[0].Id;

    for (const it of items) {
      const req2 = new sql.Request(tx);
      req2.input("ReturnId", sql.UniqueIdentifier, returnId);
      req2.input("VariantId", sql.UniqueIdentifier, it.VariantId);
      req2.input("Qty", sql.Int, it.Qty);
      await req2.query(`
        INSERT INTO SalesReturnItems (ReturnId, VariantId, Qty)
        VALUES (@ReturnId, @VariantId, @Qty)
      `);

      // ✅ Optionally update stock (increase)
      const req3 = new sql.Request(tx);
      req3.input("VariantId", sql.UniqueIdentifier, it.VariantId);
      req3.input("Qty", sql.Int, it.Qty);
      await req3.query(`
        UPDATE ProductVariants
        SET Qty = Qty + @Qty
        WHERE Id=@VariantId
      `);
    }

    await tx.commit();
    return { success: true, returnId };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ✅ Fetch recent returns
export async function getRecentReturns(limit: number = 10) {
  const db = await getDb();
  const res = await db
    .request()
    .input("n", sql.Int, limit)
    .query(`
      SELECT TOP (@n) r.Id, r.Reason, r.CreatedAt, COUNT(ri.Id) AS ItemCount
      FROM SalesReturns r
      LEFT JOIN SalesReturnItems ri ON ri.ReturnId = r.Id
      GROUP BY r.Id, r.Reason, r.CreatedAt
      ORDER BY r.CreatedAt DESC
    `);
  return res.recordset;
}
