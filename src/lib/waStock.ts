import { getDb } from "@/lib/db";
import { expandSizeAliases, type ProductStock } from "@/lib/waReply";

/*
 * Stock queries shared by the admin WhatsApp page (behind requireAdmin) and the
 * WhatsApp bot webhook (behind a server secret / Meta signature — NO admin
 * session). Keep this module free of requireAdmin so the webhook can call it.
 *
 * Pure (DB-free) helpers — parseSize, formatStockReply, expandSizeAliases — live
 * in waReply.ts so they're unit-testable without a DB or path-alias resolver.
 *
 * Numbers here mirror exactly what the admin page shows (raw ProductVariants.Qty),
 * so the bot never contradicts what the owner sees.
 */

export type { ProductStock } from "@/lib/waReply";

export type SizeWithColors = {
  size: string;
  colors: { name: string; qty: number }[];
};

/** All sizes (with their in-stock colors) for one category. */
export async function getSizesWithColorsForCategory(
  categoryId: string
): Promise<SizeWithColors[]> {
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

  const sizeMap = new Map<string, SizeWithColors>();
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

/**
 * Full live stock for one product (all sizes × colours), as promptable lines
 * like "30: Beige(1), Black(3), Navy(1)". Fed to the AI whenever we know which
 * product the customer is on, so it always has real numbers and never has to
 * guess or walk back figures it already gave. Empty string if none/unknown.
 */
export async function getProductStockText(productName: string): Promise<string> {
  const name = productName.trim();
  if (!name) return "";
  const pool = await getDb();
  const res = await pool
    .request()
    .input("product", name)
    .query(`
      SELECT s.Name AS Size, c.Name AS Color, SUM(v.Qty) AS Qty
      FROM ProductVariants v
      INNER JOIN Products p ON p.Id = v.ProductId
      INNER JOIN Sizes  s ON s.Id = v.SizeId
      INNER JOIN Colors c ON c.Id = v.ColorId
      WHERE LOWER(p.Name) = LOWER(@product)
        AND v.Qty > 0
      GROUP BY s.Name, c.Name
      HAVING SUM(v.Qty) > 0
      ORDER BY s.Name, c.Name
    `);

  const bySize = new Map<string, string[]>();
  for (const row of res.recordset ?? []) {
    const size = row.Size as string;
    if (!bySize.has(size)) bySize.set(size, []);
    bySize.get(size)!.push(`${row.Color}(${Number(row.Qty ?? 0)})`);
  }
  return Array.from(bySize.entries())
    .map(([size, colors]) => `${size}: ${colors.join(", ")}`)
    .join("\n");
}

export type CatalogItem = { product: string; category: string; price: number; sizes: string };

/**
 * Compact in-stock catalog — product, category, PRICE and sizes — fed to the AI
 * so it quotes the right price per product and can offer other items.
 */
export async function getCatalogSummary(): Promise<CatalogItem[]> {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT
      p.Name   AS Product,
      cat.Name AS Category,
      MAX(COALESCE(p.SellingPrice, 0)) AS Price,
      string_agg(DISTINCT s.Name, ', ' ORDER BY s.Name) AS Sizes
    FROM ProductVariants v
    INNER JOIN Products   p   ON p.Id  = v.ProductId
    INNER JOIN Sizes      s   ON s.Id  = v.SizeId
    INNER JOIN Categories cat ON cat.Id = p.CategoryId
    WHERE v.Qty > 0
    GROUP BY p.Name, cat.Name
    ORDER BY cat.Name, p.Name
  `);
  return (res.recordset ?? []).map((r) => ({
    product: r.Product,
    category: r.Category,
    price: Number(r.Price ?? 0),
    sizes: r.Sizes ?? "",
  }));
}

export type ResolvedVariant = {
  variantId: string;
  product: string;
  size: string;
  colour: string;
  sellingPrice: number;
  inStock: number;
};

/**
 * Resolves a variant from product + size + colour NAMES (case-insensitive) to
 * its id, real selling price, and available stock. Used to place a bot-collected
 * order and to validate the colour actually exists. Null if not found.
 */
export async function resolveVariant(
  product: string,
  size: string,
  colour: string
): Promise<ResolvedVariant | null> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("product", product.trim())
    .input("size", size.trim())
    .input("colour", colour.trim())
    .query(`
      SELECT v.Id AS VariantId, p.Name AS Product, s.Name AS Size, c.Name AS Colour,
             COALESCE(dbo.fn_available_qty(v.Id), 0) AS InStock,
             COALESCE(v.SellingPrice, p.SellingPrice, 0) AS SellingPrice
      FROM ProductVariants v
      JOIN Products p ON p.Id = v.ProductId
      JOIN Sizes    s ON s.Id = v.SizeId
      JOIN Colors   c ON c.Id = v.ColorId
      WHERE LOWER(p.Name) = LOWER(@product)
        AND LOWER(s.Name) = LOWER(@size)
        AND LOWER(c.Name) = LOWER(@colour)
      LIMIT 1
    `);
  const r = (res.recordset ?? [])[0];
  if (!r) return null;
  return {
    variantId: r.VariantId,
    product: r.Product,
    size: r.Size,
    colour: r.Colour,
    sellingPrice: Number(r.SellingPrice ?? 0),
    inStock: Number(r.InStock ?? 0),
  };
}

/**
 * What's in stock for one size (by size NAME, e.g. "32" or "L"/"Large"), grouped
 * by product. Used by the bot to answer "32" with live colours + quantities.
 */
export async function getStockBySize(sizeName: string): Promise<ProductStock[]> {
  const candidates = expandSizeAliases(sizeName);
  if (candidates.length === 0) return [];
  const pool = await getDb();

  const res = await pool
    .request()
    .input("sizes", candidates)
    .query(`
      SELECT
        p.Name   AS Product,
        cat.Name AS Category,
        c.Name   AS Color,
        SUM(v.Qty) AS Qty
      FROM ProductVariants v
      INNER JOIN Products   p   ON p.Id  = v.ProductId
      INNER JOIN Sizes      s   ON s.Id  = v.SizeId
      INNER JOIN Colors     c   ON c.Id  = v.ColorId
      INNER JOIN Categories cat ON cat.Id = p.CategoryId
      WHERE LOWER(s.Name) = ANY(@sizes)
        AND v.Qty > 0
      GROUP BY p.Name, cat.Name, c.Name
      HAVING SUM(v.Qty) > 0
      ORDER BY p.Name, c.Name
    `);

  const productMap = new Map<string, ProductStock>();
  for (const row of res.recordset ?? []) {
    const key = row.Product as string;
    if (!productMap.has(key)) {
      productMap.set(key, { product: row.Product, category: row.Category, colors: [] });
    }
    productMap.get(key)!.colors.push({
      name: row.Color,
      qty: Number(row.Qty ?? 0),
    });
  }
  return Array.from(productMap.values());
}
