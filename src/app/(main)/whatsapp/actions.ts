"use server";

import { getDb } from "@/lib/db";

/**
 * Get all product categories
 */
export async function getProductCategories() {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT Id, Name
    FROM Categories
    ORDER BY Name
  `);
  return (res.recordset ?? []) as { Id: string; Name: string }[];
}

/**
 * Get sizes with their available colors (qty > 0) for a specific category
 */
export async function getSizesWithColors(categoryId: string) {
  if (!categoryId) return [];
  const pool = await getDb();

  const res = await pool
    .request()
    .input("catId", categoryId)
    .query(`
      SELECT
        s.Id   AS SizeId,
        s.Name AS Size,
        c.Name AS Color,
        SUM(v.Qty) AS Qty
      FROM ProductVariants v
      INNER JOIN Products p ON p.Id = v.ProductId
      INNER JOIN Sizes  s ON s.Id = v.SizeId
      INNER JOIN Colors c ON c.Id = v.ColorId
      WHERE p.CategoryId = @catId
        AND v.Qty > 0
      GROUP BY s.Id, s.Name, c.Name
      HAVING SUM(v.Qty) > 0
      ORDER BY s.Name, c.Name
    `);

  const sizeMap = new Map<
    string,
    { size: string; colors: { name: string; qty: number }[] }
  >();

  for (const row of res.recordset ?? []) {
    const sizeId = row.SizeId;
    if (!sizeMap.has(sizeId)) {
      sizeMap.set(sizeId, { size: row.Size, colors: [] });
    }
    sizeMap.get(sizeId)!.colors.push({
      name: row.Color,
      qty: Number(row.Qty ?? 0),
    });
  }

  return Array.from(sizeMap.values());
}
