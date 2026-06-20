"use server";

import { getDb, sql } from "@/lib/db";
import { slugWithId, slugify } from "@/lib/slug";

/* ============================================================
   CATALOG (storefront-facing product + category management)
   Operates on the same Products / ProductVariants / Categories
   / ProductImages tables used by the admin & storefront.
   ============================================================ */

export type CatalogProduct = {
  Id: string;
  Name: string;
  Slug: string | null;
  SKU: string;
  CategoryId: string;
  CategoryName: string;
  CostPrice: number;
  SellingPrice: number;
  CompareAtPrice: number | null;
  Description: string | null;
  ImageUrl: string | null;
  IsActive: boolean;
  IsFeatured: boolean;
  IsNewArrival: boolean;
  IsDtfPrintable: boolean;
  SortOrder: number;
  Stock: number;
  ImageCount: number;
};

export async function getCatalogProducts(): Promise<CatalogProduct[]> {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT
      p.Id, p.Name, p.Slug, p.SKU, p.CategoryId,
      cat.Name AS CategoryName,
      p.CostPrice, p.SellingPrice, p.CompareAtPrice,
      p.Description, p.ImageUrl, p.IsActive, p.IsFeatured, p.IsNewArrival, p.IsDtfPrintable, p.SortOrder,
      ISNULL((SELECT SUM(v.Qty) FROM ProductVariants v WHERE v.ProductId = p.Id), 0) AS Stock,
      (SELECT COUNT(*) FROM ProductImages pi WHERE pi.ProductId = p.Id) AS ImageCount
    FROM Products p
    LEFT JOIN Categories cat ON cat.Id = p.CategoryId
    ORDER BY p.SortOrder, p.Name
  `);
  return res.recordset as CatalogProduct[];
}

export async function getProductForEdit(id: string) {
  const pool = await getDb();
  const prod = await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`
      SELECT Id, Name, Slug, SKU, CategoryId, CostPrice, SellingPrice,
             CompareAtPrice, Description, ImageUrl, IsActive, IsFeatured, IsNewArrival, IsDtfPrintable, SortOrder
      FROM Products WHERE Id=@Id
    `);
  const imgs = await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`SELECT Id, Url, ColorId, SortOrder FROM ProductImages WHERE ProductId=@Id ORDER BY SortOrder`);
  // distinct colours this product actually uses (from its variants)
  const cols = await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`
      SELECT DISTINCT c.Id, c.Name, c.Hex
      FROM ProductVariants v
      JOIN Colors c ON c.Id = v.ColorId
      WHERE v.ProductId=@Id
      ORDER BY c.Name
    `);
  return { product: prod.recordset[0], images: imgs.recordset, colors: cols.recordset };
}

export type ProductStorefrontInput = {
  name: string;
  slug: string;
  description: string | null;
  compareAtPrice: number | null;
  isActive: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  isDtfPrintable: boolean;
  sortOrder: number;
};

export async function updateProductStorefront(id: string, data: ProductStorefrontInput) {
  const pool = await getDb();
  const slug = data.slug?.trim() ? slugify(data.slug) : slugWithId(data.name, id);
  await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .input("Slug", sql.NVarChar(250), slug)
    .input("Description", sql.NVarChar(sql.MAX), data.description || null)
    .input("CompareAtPrice", sql.Decimal(18, 2), data.compareAtPrice ?? null)
    .input("IsActive", sql.Bit, data.isActive)
    .input("IsFeatured", sql.Bit, data.isFeatured)
    .input("IsNewArrival", sql.Bit, data.isNewArrival)
    .input("IsDtfPrintable", sql.Bit, data.isDtfPrintable)
    .input("SortOrder", sql.Int, data.sortOrder ?? 0)
    .query(`
      UPDATE Products
      SET Slug=@Slug, Description=@Description, CompareAtPrice=@CompareAtPrice,
          IsActive=@IsActive, IsFeatured=@IsFeatured, IsNewArrival=@IsNewArrival,
          IsDtfPrintable=@IsDtfPrintable, SortOrder=@SortOrder
      WHERE Id=@Id
    `);
  return true;
}

// Quick toggles from the list view
export async function toggleProductFlag(id: string, field: "IsActive" | "IsFeatured" | "IsNewArrival" | "IsDtfPrintable", value: boolean) {
  const pool = await getDb();
  await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .input("Val", sql.Bit, value)
    .query(`UPDATE Products SET ${field}=@Val WHERE Id=@Id`);
  return true;
}

/* ---------- Product images ---------- */

export type ProductImageInput = { url: string; colorId: string | null };

// Replace the full image set for a product, preserving each image's colour
// (colorId NULL = shared / all colours). The first SHARED image (else first
// overall) becomes the primary Products.ImageUrl.
export async function setProductImages(productId: string, images: ProductImageInput[]) {
  const pool = await getDb();
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();
    await new sql.Request(tx)
      .input("Pid", sql.UniqueIdentifier, productId)
      .query(`DELETE FROM ProductImages WHERE ProductId=@Pid`);

    let i = 0;
    for (const img of images) {
      await new sql.Request(tx)
        .input("Pid", sql.UniqueIdentifier, productId)
        .input("Url", sql.NVarChar(500), img.url)
        .input("ColorId", sql.UniqueIdentifier, img.colorId || null)
        .input("Sort", sql.Int, i++)
        .query(`INSERT INTO ProductImages (ProductId, Url, ColorId, SortOrder) VALUES (@Pid, @Url, @ColorId, @Sort)`);
    }

    const primary = images.find((im) => !im.colorId)?.url || images[0]?.url || null;
    await new sql.Request(tx)
      .input("Pid", sql.UniqueIdentifier, productId)
      .input("Primary", sql.NVarChar(500), primary)
      .query(`UPDATE Products SET ImageUrl=@Primary WHERE Id=@Pid`);

    await tx.commit();
    return true;
  } catch (err) {
    try { await tx.rollback(); } catch {}
    throw err;
  }
}

/* ---------- Categories ---------- */

export type CatalogCategory = {
  Id: string;
  Name: string;
  Slug: string | null;
  ImageUrl: string | null;
  Description: string | null;
  IsActive: boolean;
  SortOrder: number;
  ProductCount: number;
};

export async function getCatalogCategories(): Promise<CatalogCategory[]> {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT c.Id, c.Name, c.Slug, c.ImageUrl, c.Description, c.IsActive, c.SortOrder,
           (SELECT COUNT(*) FROM Products p WHERE p.CategoryId = c.Id) AS ProductCount
    FROM Categories c
    ORDER BY c.SortOrder, c.Name
  `);
  return res.recordset as CatalogCategory[];
}

export type CategoryStorefrontInput = {
  name: string;
  slug: string;
  imageUrl: string | null;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
};

/* ---------- Colours (hex swatch) ---------- */

export type AdminColor = {
  Id: string;
  Name: string;
  Hex: string | null;
  UsageCount: number;
};

export async function getColorsAdmin(): Promise<AdminColor[]> {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT c.Id, c.Name, c.Hex,
           (SELECT COUNT(*) FROM ProductVariants v WHERE v.ColorId = c.Id) AS UsageCount
    FROM Colors c
    ORDER BY c.Name
  `);
  return res.recordset as AdminColor[];
}

export async function updateColorHex(id: string, hex: string | null) {
  const pool = await getDb();
  const clean = hex && hex.trim() ? (hex.trim().startsWith("#") ? hex.trim() : `#${hex.trim()}`) : null;
  await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .input("Hex", sql.NVarChar(20), clean)
    .query(`UPDATE Colors SET Hex=@Hex WHERE Id=@Id`);
  return true;
}

export async function updateCategoryStorefront(id: string, data: CategoryStorefrontInput) {
  const pool = await getDb();
  const slug = data.slug?.trim() ? slugify(data.slug) : slugWithId(data.name, id);
  await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .input("Slug", sql.NVarChar(150), slug)
    .input("ImageUrl", sql.NVarChar(500), data.imageUrl || null)
    .input("Description", sql.NVarChar(500), data.description || null)
    .input("IsActive", sql.Bit, data.isActive)
    .input("SortOrder", sql.Int, data.sortOrder ?? 0)
    .query(`
      UPDATE Categories
      SET Slug=@Slug, ImageUrl=@ImageUrl, Description=@Description,
          IsActive=@IsActive, SortOrder=@SortOrder
      WHERE Id=@Id
    `);
  return true;
}
