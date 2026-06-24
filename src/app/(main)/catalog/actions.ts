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
  BlankProductId: string | null;
  BlankName: string | null;
  DtfProfit: number | null;
  PrintOnDemand: boolean;
  SelectByImage: boolean;
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
      p.Description, p.ImageUrl, p.IsActive, p.IsFeatured, p.IsNewArrival, p.IsDtfPrintable,
      p.BlankProductId, blank.Name AS BlankName, p.DtfProfit, p.PrintOnDemand, p.SelectByImage, p.SortOrder,
      COALESCE((SELECT SUM(b.Qty) FROM ProductVariants b WHERE b.ProductId = COALESCE(p.BlankProductId, p.Id)), 0) AS Stock,
      (SELECT COUNT(*) FROM ProductImages pi WHERE pi.ProductId = p.Id) AS ImageCount
    FROM Products p
    LEFT JOIN Categories cat ON cat.Id = p.CategoryId
    LEFT JOIN Products blank ON blank.Id = p.BlankProductId
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
             CompareAtPrice, Description, ImageUrl, IsActive, IsFeatured, IsNewArrival, IsDtfPrintable,
             BlankProductId, DtfProfit, PrintOnDemand, SizeChartUrl, SelectByImage, SortOrder
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
  blankProductId: string | null;
  dtfProfit: number | null;
  printOnDemand: boolean;
  sizeChartUrl: string | null;
  selectByImage: boolean;
  sortOrder: number;
};

export async function updateProductStorefront(id: string, data: ProductStorefrontInput) {
  const pool = await getDb();
  const slug = data.slug?.trim() ? slugify(data.slug) : slugWithId(data.name, id);
  // A product can't be its own blank, and a blank can't itself be linked (no chains).
  const blankId = data.blankProductId && data.blankProductId !== id ? data.blankProductId : null;
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
    .input("BlankProductId", sql.UniqueIdentifier, blankId)
    .input("DtfProfit", sql.Decimal(10, 2), data.dtfProfit ?? null)
    .input("PrintOnDemand", sql.Bit, data.printOnDemand)
    .input("SizeChartUrl", sql.NVarChar(500), data.sizeChartUrl || null)
    .input("SelectByImage", sql.Bit, data.selectByImage)
    .input("SortOrder", sql.Int, data.sortOrder ?? 0)
    .query(`
      UPDATE Products
      SET Slug=@Slug, Description=@Description, CompareAtPrice=@CompareAtPrice,
          IsActive=@IsActive, IsFeatured=@IsFeatured, IsNewArrival=@IsNewArrival,
          IsDtfPrintable=@IsDtfPrintable, BlankProductId=@BlankProductId,
          DtfProfit=@DtfProfit, PrintOnDemand=@PrintOnDemand, SizeChartUrl=@SizeChartUrl,
          SelectByImage=@SelectByImage, SortOrder=@SortOrder
      WHERE Id=@Id
    `);

  // When linked to a blank, mirror the blank's size/colour variants onto this
  // product (Qty 0 — stock lives on the blank) so the storefront shows options.
  if (blankId) {
    await pool
      .request()
      .input("Id", sql.UniqueIdentifier, id)
      .input("BlankId", sql.UniqueIdentifier, blankId)
      .query(`
        INSERT INTO ProductVariants (ProductId, SizeId, ColorId, Qty, CostPrice, SellingPrice)
        SELECT @Id, b.SizeId, b.ColorId, 0,
               (SELECT CostPrice FROM Products WHERE Id=@Id),
               (SELECT SellingPrice FROM Products WHERE Id=@Id)
        FROM ProductVariants b
        WHERE b.ProductId = @BlankId
          AND NOT EXISTS (
            SELECT 1 FROM ProductVariants v
            WHERE v.ProductId = @Id
              AND COALESCE((v.SizeId)::text, '') = COALESCE((b.SizeId)::text, '')
              AND COALESCE((v.ColorId)::text, '') = COALESCE((b.ColorId)::text, '')
          )
      `);
  }
  return true;
}

/* Products eligible to be a stock-source blank for `selfId`:
   active, not the product itself, and not already linked to a blank (no chains). */
export async function getBlankCandidates(selfId: string) {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("Self", sql.UniqueIdentifier, selfId)
    .query(`
      SELECT Id, Name FROM Products
      WHERE Id <> @Self AND BlankProductId IS NULL
      ORDER BY Name
    `);
  return res.recordset as { Id: string; Name: string }[];
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

/* ---------- Designs (select-by-image products) ----------
   Each design is a colour-less ProductImages row linked to its own
   ProductVariants row (SizeId/ColorId NULL) via ProductImages.VariantId, so the
   customer's chosen design rides on VariantId and reuses all order/stock logic. */

export type ProductDesign = {
  ImageId: string;
  Url: string;
  SortOrder: number;
  VariantId: string | null;
  Qty: number | null;
  SellingPrice: number | null;
};

export async function getProductDesigns(productId: string): Promise<ProductDesign[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", sql.UniqueIdentifier, productId)
    .query(`
      SELECT pi.Id AS ImageId, pi.Url, pi.SortOrder, pi.VariantId, v.Qty, v.SellingPrice
      FROM ProductImages pi
      LEFT JOIN ProductVariants v ON v.Id = pi.VariantId
      WHERE pi.ProductId = @pid AND pi.ColorId IS NULL
      ORDER BY pi.SortOrder
    `);
  return res.recordset as ProductDesign[];
}

export type DesignInput = { imageId?: string | null; url: string; qty: number };

export async function saveDesigns(productId: string, designs: DesignInput[]) {
  const pool = await getDb();
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();

    const prod = await new sql.Request(tx)
      .input("Id", sql.UniqueIdentifier, productId)
      .query(`SELECT CostPrice, SellingPrice FROM Products WHERE Id=@Id LIMIT 1`);
    const cost = prod.recordset[0]?.CostPrice ?? 0;
    const sell = prod.recordset[0]?.SellingPrice ?? 0;

    const existing = await new sql.Request(tx)
      .input("pid", sql.UniqueIdentifier, productId)
      .query(`SELECT Id, Url, VariantId FROM ProductImages WHERE ProductId=@pid AND ColorId IS NULL`);
    const existingById = new Map<string, { Id: string; Url: string; VariantId: string | null }>(
      existing.recordset.map((r: any) => [r.Id, r])
    );

    const keep = new Set<string>();
    let sort = 0;
    for (const d of designs) {
      const q = Math.max(0, Math.floor(Number(d.qty) || 0));
      const existingRow = d.imageId ? existingById.get(d.imageId) : undefined;

      if (existingRow) {
        keep.add(existingRow.Id);
        let variantId = existingRow.VariantId;
        let prevQty = 0;
        if (variantId) {
          const vr = await new sql.Request(tx).input("Id", sql.UniqueIdentifier, variantId)
            .query(`SELECT Qty FROM ProductVariants WHERE Id=@Id LIMIT 1`);
          prevQty = vr.recordset[0]?.Qty ?? 0;
          await new sql.Request(tx).input("Id", sql.UniqueIdentifier, variantId).input("Qty", sql.Int, q)
            .query(`UPDATE ProductVariants SET Qty=@Qty WHERE Id=@Id`);
        } else {
          const vIns = await new sql.Request(tx)
            .input("Pid", sql.UniqueIdentifier, productId).input("Qty", sql.Int, q)
            .input("Cost", sql.Decimal(18, 2), cost).input("Sell", sql.Decimal(18, 2), sell)
            .query(`INSERT INTO ProductVariants (ProductId, SizeId, ColorId, Qty, CostPrice, SellingPrice) VALUES (@Pid, NULL, NULL, @Qty, @Cost, @Sell) RETURNING Id`);
          variantId = vIns.recordset[0].Id;
        }
        await new sql.Request(tx)
          .input("Id", sql.UniqueIdentifier, existingRow.Id).input("Url", sql.NVarChar(500), d.url)
          .input("Vid", sql.UniqueIdentifier, variantId).input("Sort", sql.Int, sort)
          .query(`UPDATE ProductImages SET Url=@Url, VariantId=@Vid, SortOrder=@Sort WHERE Id=@Id`);
        if (q !== prevQty) {
          await new sql.Request(tx)
            .input("VariantId", sql.UniqueIdentifier, variantId).input("ChangeQty", sql.Int, q - prevQty)
            .input("Prev", sql.Int, prevQty).input("New", sql.Int, q).input("Price", sql.Decimal(18, 2), sell)
            .query(`INSERT INTO StockHistory (VariantId, ChangeQty, Reason, PreviousQty, NewQty, PriceAtChange, CreatedAt)
                    VALUES (@VariantId, @ChangeQty, 'design-stock', @Prev, @New, @Price, now())`);
        }
      } else {
        const vIns = await new sql.Request(tx)
          .input("Pid", sql.UniqueIdentifier, productId).input("Qty", sql.Int, q)
          .input("Cost", sql.Decimal(18, 2), cost).input("Sell", sql.Decimal(18, 2), sell)
          .query(`INSERT INTO ProductVariants (ProductId, SizeId, ColorId, Qty, CostPrice, SellingPrice) VALUES (@Pid, NULL, NULL, @Qty, @Cost, @Sell) RETURNING Id`);
        const variantId = vIns.recordset[0].Id;
        await new sql.Request(tx)
          .input("Pid", sql.UniqueIdentifier, productId).input("Url", sql.NVarChar(500), d.url)
          .input("Vid", sql.UniqueIdentifier, variantId).input("Sort", sql.Int, sort)
          .query(`INSERT INTO ProductImages (ProductId, Url, ColorId, VariantId, SortOrder) VALUES (@Pid, @Url, NULL, @Vid, @Sort)`);
        if (q > 0) {
          await new sql.Request(tx)
            .input("VariantId", sql.UniqueIdentifier, variantId).input("ChangeQty", sql.Int, q)
            .input("Prev", sql.Int, 0).input("New", sql.Int, q).input("Price", sql.Decimal(18, 2), sell)
            .query(`INSERT INTO StockHistory (VariantId, ChangeQty, Reason, PreviousQty, NewQty, PriceAtChange, CreatedAt)
                    VALUES (@VariantId, @ChangeQty, 'design-stock', @Prev, @New, @Price, now())`);
        }
      }
      sort++;
    }

    // Removed designs: delete the image; keep the variant (Qty 0) if it has order
    // history, else delete it.
    for (const row of existing.recordset as Array<{ Id: string; VariantId: string | null }>) {
      if (keep.has(row.Id)) continue;
      await new sql.Request(tx).input("Id", sql.UniqueIdentifier, row.Id)
        .query(`DELETE FROM ProductImages WHERE Id=@Id`);
      if (row.VariantId) {
        const used = await new sql.Request(tx).input("Vid", sql.UniqueIdentifier, row.VariantId)
          .query(`SELECT 1 AS X FROM OrderItems WHERE VariantId=@Vid LIMIT 1`);
        if (used.recordset.length) {
          await new sql.Request(tx).input("Vid", sql.UniqueIdentifier, row.VariantId)
            .query(`UPDATE ProductVariants SET Qty=0 WHERE Id=@Vid`);
        } else {
          await new sql.Request(tx).input("Vid", sql.UniqueIdentifier, row.VariantId)
            .query(`DELETE FROM ProductVariants WHERE Id=@Vid`);
        }
      }
    }

    // Ensure the product has a primary image (first design) for cards/listing.
    await new sql.Request(tx).input("pid", sql.UniqueIdentifier, productId)
      .query(`UPDATE Products SET ImageUrl = COALESCE(ImageUrl, (SELECT Url FROM ProductImages WHERE ProductId=@pid AND ColorId IS NULL ORDER BY SortOrder LIMIT 1)) WHERE Id=@pid`);

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
