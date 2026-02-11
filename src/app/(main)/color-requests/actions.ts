"use server";

import { getDb } from "@/lib/db";
import sql from "mssql";

export async function getCategories() {
  const pool = await getDb();
  const res = await pool.request().query(`SELECT Id, Name FROM Categories ORDER BY Name`);
  return res.recordset as { Id: string; Name: string }[];
}

export async function getProductsByCategory(categoryId: string) {
  const pool = await getDb();
  const res = await pool.request()
    .input("cat", sql.UniqueIdentifier, categoryId)
    .query(`SELECT Id, Name FROM Products WHERE CategoryId=@cat ORDER BY Name`);
  return res.recordset as { Id: string; Name: string }[];
}

export async function getSizesByProduct(productId: string) {
  const pool = await getDb();
  const res = await pool.request()
    .input("pid", sql.UniqueIdentifier, productId)
    .query(`
      SELECT DISTINCT s.Id, s.Name
      FROM ProductVariants v
      JOIN Sizes s ON s.Id = v.SizeId
      WHERE v.ProductId=@pid
      ORDER BY s.Name
    `);
  return res.recordset as { Id: string; Name: string }[];
}

export async function getColorsByProductAndSize(productId: string, sizeId: string) {
  const pool = await getDb();
  const res = await pool.request()
    .input("pid", sql.UniqueIdentifier, productId)
    .input("sid", sql.UniqueIdentifier, sizeId)
    .query(`
      SELECT DISTINCT c.Id, c.Name
      FROM ProductVariants v
      JOIN Colors c ON c.Id = v.ColorId
      WHERE v.ProductId=@pid AND v.SizeId=@sid
      ORDER BY c.Name
    `);
  return res.recordset as { Id: string; Name: string }[];
}

export async function getAllColors() {
  const pool = await getDb();
  const res = await pool.request().query(`SELECT Id, Name FROM Colors ORDER BY Name`);
  return res.recordset as { Id: string; Name: string }[];
}

export async function getAllSizes() {
  const pool = await getDb();
  const res = await pool.request().query(`SELECT Id, Name FROM Sizes ORDER BY Name`);
  return res.recordset as { Id: string; Name: string }[];
}

export async function getColorRequests() {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT Id, CustomerName, Phone, ProductName, ColorName, SizeName, Notes, Status, CreatedAt
    FROM ColorRequests
    ORDER BY CreatedAt DESC
  `);
  return res.recordset;
}

export async function createColorRequest(
  customerName: string | null,
  phone: string,
  productName: string,
  colorName: string,
  sizeName: string | null,
  notes: string | null
) {
  const pool = await getDb();
  const id = crypto.randomUUID();

  await pool.request()
    .input("Id", sql.UniqueIdentifier, id)
    .input("CustomerName", sql.NVarChar(200), customerName || null)
    .input("Phone", sql.NVarChar(50), phone)
    .input("ProductName", sql.NVarChar(200), productName)
    .input("ColorName", sql.NVarChar(100), colorName)
    .input("SizeName", sql.NVarChar(50), sizeName || null)
    .input("Notes", sql.NVarChar(sql.MAX), notes || null)
    .input("Status", sql.NVarChar(20), "Pending")
    .input("CreatedAt", sql.DateTime2, new Date())
    .query(`
      INSERT INTO ColorRequests (Id, CustomerName, Phone, ProductName, ColorName, SizeName, Notes, Status, CreatedAt)
      VALUES (@Id, @CustomerName, @Phone, @ProductName, @ColorName, @SizeName, @Notes, @Status, @CreatedAt)
    `);

  return { Id: id };
}

export async function updateColorRequest(
  id: string,
  customerName: string | null,
  phone: string,
  productName: string,
  colorName: string,
  sizeName: string | null,
  notes: string | null
) {
  const pool = await getDb();
  await pool.request()
    .input("Id", sql.UniqueIdentifier, id)
    .input("CustomerName", sql.NVarChar(200), customerName || null)
    .input("Phone", sql.NVarChar(50), phone)
    .input("ProductName", sql.NVarChar(200), productName)
    .input("ColorName", sql.NVarChar(100), colorName)
    .input("SizeName", sql.NVarChar(50), sizeName || null)
    .input("Notes", sql.NVarChar(sql.MAX), notes || null)
    .query(`
      UPDATE ColorRequests
      SET CustomerName=@CustomerName, Phone=@Phone, ProductName=@ProductName,
          ColorName=@ColorName, SizeName=@SizeName, Notes=@Notes
      WHERE Id=@Id
    `);
  return true;
}

export async function updateColorRequestStatus(id: string, status: string) {
  const pool = await getDb();
  await pool.request()
    .input("Id", sql.UniqueIdentifier, id)
    .input("Status", sql.NVarChar(20), status)
    .query(`UPDATE ColorRequests SET Status=@Status WHERE Id=@Id`);
  return true;
}

export async function deleteColorRequest(id: string) {
  const pool = await getDb();
  await pool.request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`DELETE FROM ColorRequests WHERE Id=@Id`);
  return true;
}
