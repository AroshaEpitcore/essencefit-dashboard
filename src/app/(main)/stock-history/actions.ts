"use server";
import { getDb } from "@/lib/db";
import sql from "mssql";

/* ---------- Stock History with details ---------- */
export async function getStockHistory(filters?: {
  categoryId?: string;
  productId?: string;
  sizeId?: string;
  colorId?: string;
  from?: string;
  to?: string;
}) {
  const db = await getDb();
  const req = db.request();

  if (filters?.categoryId)
    req.input("CategoryId", sql.UniqueIdentifier, filters.categoryId);
  if (filters?.productId)
    req.input("ProductId", sql.UniqueIdentifier, filters.productId);
  if (filters?.sizeId)
    req.input("SizeId", sql.UniqueIdentifier, filters.sizeId);
  if (filters?.colorId)
    req.input("ColorId", sql.UniqueIdentifier, filters.colorId);
  if (filters?.from)
    req.input("From", sql.DateTime2, new Date(filters.from));
  if (filters?.to)
    req.input("To", sql.DateTime2, new Date(filters.to));

  const where = [];
  if (filters?.categoryId) where.push("p.CategoryId=@CategoryId");
  if (filters?.productId) where.push("p.Id=@ProductId");
  if (filters?.sizeId) where.push("s.Id=@SizeId");
  if (filters?.colorId) where.push("c.Id=@ColorId");
  if (filters?.from) where.push("h.CreatedAt >= @From");
  if (filters?.to) where.push("h.CreatedAt <= @To");

  const query = `
    SELECT 
      h.Id,
      h.CreatedAt,
      h.ChangeQty,
      h.Reason,
      h.PreviousQty,
      h.NewQty,
      h.PriceAtChange,
      p.Name AS ProductName,
      cat.Name AS CategoryName,
      s.Name AS SizeName,
      c.Name AS ColorName
    FROM StockHistory h
      JOIN ProductVariants v ON v.Id = h.VariantId
      JOIN Products p ON p.Id = v.ProductId
      JOIN Categories cat ON cat.Id = p.CategoryId
      LEFT JOIN Sizes s ON s.Id = v.SizeId
      LEFT JOIN Colors c ON c.Id = v.ColorId
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY h.CreatedAt DESC
  `;

  const res = await req.query(query);
  return res.recordset;
}
