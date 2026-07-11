"use server";

import { requireAdmin } from "@/lib/adminAuth";
import { getDb } from "@/lib/db";
import sql from "@/lib/sqlShim";

/* ---------- Stock History with details ---------- */
export async function getStockHistory(
  filters?: {
    categoryId?: string;
    productId?: string;
    sizeId?: string;
    colorId?: string;
    from?: string;
    to?: string;
  },
  paging?: { limit?: number; offset?: number }
) {
  await requireAdmin();
  const limit = Math.min(Math.max(paging?.limit ?? 50, 1), 5000); // 5000 = CSV-export ceiling
  const offset = Math.max(paging?.offset ?? 0, 0);
  const db = await getDb();

  const bind = (req: any) => {
    if (filters?.categoryId) req.input("CategoryId", sql.UniqueIdentifier, filters.categoryId);
    if (filters?.productId) req.input("ProductId", sql.UniqueIdentifier, filters.productId);
    if (filters?.sizeId) req.input("SizeId", sql.UniqueIdentifier, filters.sizeId);
    if (filters?.colorId) req.input("ColorId", sql.UniqueIdentifier, filters.colorId);
    if (filters?.from) req.input("From", sql.DateTime2, new Date(filters.from));
    if (filters?.to) req.input("To", sql.DateTime2, new Date(filters.to));
    return req;
  };

  const where = [];
  if (filters?.categoryId) where.push("p.CategoryId=@CategoryId");
  if (filters?.productId) where.push("p.Id=@ProductId");
  if (filters?.sizeId) where.push("s.Id=@SizeId");
  if (filters?.colorId) where.push("c.Id=@ColorId");
  if (filters?.from) where.push("h.CreatedAt >= @From");
  if (filters?.to) where.push("h.CreatedAt <= @To");
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const joins = `
    FROM StockHistory h
      JOIN ProductVariants v ON v.Id = h.VariantId
      JOIN Products p ON p.Id = v.ProductId
      JOIN Categories cat ON cat.Id = p.CategoryId
      LEFT JOIN Sizes s ON s.Id = v.SizeId
      LEFT JOIN Colors c ON c.Id = v.ColorId
  `;

  const res = await bind(db.request())
    .input("Limit", sql.Int, limit)
    .input("Offset", sql.Int, offset)
    .query(`
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
    ${joins}
    ${whereSql}
    ORDER BY h.CreatedAt DESC
    LIMIT @Limit OFFSET @Offset
  `);

  const count = await bind(db.request()).query(`SELECT COUNT(*)::int AS "Total" ${joins} ${whereSql}`);

  return { rows: res.recordset, total: Number(count.recordset[0]?.Total ?? 0) };
}
