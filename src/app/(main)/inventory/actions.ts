"use server";

import { getDb } from "@/lib/db";

/**
 * Get base lookups for dropdowns (Categories, Sizes, Colors)
 * Returns: { categories: {Id,Name}[], sizes: {...}[], colors: {...}[] }
 */
export async function getLookups() {
  const pool = await getDb();

  const [cats, sizes, colors] = await Promise.all([
    pool.request().query(`
      SELECT Id, Name
      FROM Categories
      ORDER BY Name
    `),
    pool.request().query(`
      SELECT Id, Name
      FROM Sizes
      ORDER BY Name
    `),
    pool.request().query(`
      SELECT Id, Name
      FROM Colors
      ORDER BY Name
    `),
  ]);

  return {
    categories: cats.recordset ?? [],
    sizes: sizes.recordset ?? [],
    colors: colors.recordset ?? [],
  };
}

/**
 * Products in a category (for cascading pickers)
 */
export async function getProductsByCategory(categoryId: string) {
  if (!categoryId) return [];
  const pool = await getDb();
  const res = await pool
    .request()
    .input("catId", categoryId)
    .query(`
      SELECT Id, Name, SKU
      FROM Products
      WHERE CategoryId = @catId
      ORDER BY Name
    `);
  return res.recordset ?? [];
}

/**
 * Colors by Category & Size (across all products in the category),
 * aggregated by color name with total available Qty.
 */
export async function getColorsByCategorySize(
  categoryId: string,
  sizeId: string
) {
  if (!categoryId || !sizeId) return [];
  const pool = await getDb();

  const res = await pool
    .request()
    .input("catId", categoryId)
    .input("sizeId", sizeId)
    .query(`
      SELECT c.Name AS Color, SUM(v.Qty) AS Qty
      FROM ProductVariants v
      INNER JOIN Products p ON p.Id = v.ProductId
      INNER JOIN Colors   c ON c.Id = v.ColorId
      WHERE p.CategoryId = @catId
        AND v.SizeId     = @sizeId
      GROUP BY c.Name
      ORDER BY c.Name
    `);

  // Ensure numbers
  return (res.recordset ?? []).map((r: any) => ({
    Color: r.Color,
    Qty: Number(r.Qty ?? 0),
  }));
}

/**
 * Product quantity cards per category.
 * Shows total qty and count of low-stock variants (Qty <= MinQtyAlert but > 0).
 */
export async function getProductQuantities(categoryId: string) {
  if (!categoryId) return [];
  const pool = await getDb();

  const res = await pool
    .request()
    .input("catId", categoryId)
    .query(`
      SELECT
        p.Id,
        p.Name,
        p.SKU,
        ISNULL(SUM(v.Qty), 0) AS TotalQty
      FROM Products p
      LEFT JOIN ProductVariants v ON v.ProductId = p.Id
      WHERE p.CategoryId = @catId
      GROUP BY p.Id, p.Name, p.SKU
      ORDER BY p.Name
    `);

  return (res.recordset ?? []).map((r: any) => ({
    Id: r.Id,
    Name: r.Name,
    SKU: r.SKU,
    TotalQty: Number(r.TotalQty ?? 0),
    LowStockVariants: 0, // no MinQtyAlert support
  }));
}


/**
 * Availability check for a specific Product + Size + Color.
 * Returns integer quantity (0 if missing).
 */
export async function getAvailability(
  productId: string,
  sizeId: string,
  colorId: string
) {
  if (!productId || !sizeId || !colorId) return 0;

  const pool = await getDb();
  const res = await pool
    .request()
    .input("prodId", productId)
    .input("sizeId", sizeId)
    .input("colorId", colorId)
    .query(`
      SELECT Qty
      FROM ProductVariants
      WHERE ProductId = @prodId
        AND SizeId    = @sizeId
        AND ColorId   = @colorId
    `);

  if (!res.recordset?.length) return 0;
  return Number(res.recordset[0].Qty ?? 0);
}
