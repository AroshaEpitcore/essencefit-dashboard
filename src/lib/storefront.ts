import { getDb, sql } from "@/lib/db";

/* Read-only catalog helpers for the public storefront.
   Safe to call from server components. Only returns active/published data. */

export type ProductColor = {
  Id: string;
  Name: string;
  Hex: string | null;
  ImageUrl: string | null;
  ImageUrl2: string | null; // second image of the same colour (for card hover)
  InStock: boolean;
};

export type StoreProduct = {
  Id: string;
  Name: string;
  Slug: string;
  ImageUrl: string | null;
  HoverImageUrl: string | null;
  SellingPrice: number;
  CompareAtPrice: number | null;
  CategoryName: string | null;
  CategorySlug: string | null;
  Stock: number;
  IsNewArrival: boolean;
  Colors: ProductColor[];
};

export type StoreCategory = {
  Id: string;
  Name: string;
  Slug: string;
  ImageUrl: string | null;
  Description: string | null;
  ProductCount: number;
};

const PRODUCT_SELECT = `
  SELECT
    p.Id, p.Name, p.Slug, p.ImageUrl, p.SellingPrice, p.CompareAtPrice, p.IsNewArrival,
    cat.Name AS CategoryName, cat.Slug AS CategorySlug,
    COALESCE((SELECT SUM(b.Qty) FROM ProductVariants b WHERE b.ProductId = COALESCE(p.BlankProductId, p.Id)), 0) AS Stock,
    (SELECT pi.Url FROM ProductImages pi
       WHERE pi.ProductId = p.Id AND (p.ImageUrl IS NULL OR pi.Url <> p.ImageUrl)
       ORDER BY CASE WHEN pi.ColorId IS NULL THEN 0 ELSE 1 END, pi.SortOrder LIMIT 1) AS HoverImageUrl
  FROM Products p
  LEFT JOIN Categories cat ON cat.Id = p.CategoryId
`;

/* Attach the distinct colours (with hex) used by each product in one batched query.
   Returns the same array with Colors populated. Safe on all SQL Server versions. */
async function attachColors<T extends StoreProduct>(
  pool: Awaited<ReturnType<typeof getDb>>,
  rows: T[]
): Promise<T[]> {
  rows.forEach((r) => (r.Colors = []));
  if (rows.length === 0) return rows;

  const req = pool.request();
  const params = rows.map((r, i) => {
    req.input(`p${i}`, sql.UniqueIdentifier, r.Id);
    return `@p${i}`;
  });
  const res = await req.query(`
    SELECT v.ProductId, c.Id, c.Name, c.Hex,
      (SELECT pi.Url FROM ProductImages pi
         WHERE pi.ProductId = v.ProductId AND pi.ColorId = c.Id ORDER BY pi.SortOrder LIMIT 1) AS ImageUrl,
      (SELECT pi.Url FROM ProductImages pi
         WHERE pi.ProductId = v.ProductId AND pi.ColorId = c.Id
         ORDER BY pi.SortOrder LIMIT 1 OFFSET 1) AS ImageUrl2,
      COALESCE((SELECT MIN(pi.SortOrder) FROM ProductImages pi
         WHERE pi.ProductId = v.ProductId AND pi.ColorId = c.Id), 2147483647) AS ImgSort,
      MAX(CASE WHEN COALESCE(sv.Qty, 0) > 0 THEN 1 ELSE 0 END) AS InStock
    FROM ProductVariants v
    JOIN Colors c ON c.Id = v.ColorId
    LEFT JOIN LATERAL (SELECT z.Qty FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(v.Id)) sv ON true
    WHERE v.ColorId IS NOT NULL AND v.ProductId IN (${params.join(",")})
    GROUP BY v.ProductId, c.Id, c.Name, c.Hex
    ORDER BY ImgSort, c.Name
  `);
  const byProduct: Record<string, ProductColor[]> = {};
  for (const row of res.recordset as { ProductId: string; Id: string; Name: string; Hex: string | null; ImageUrl: string | null; ImageUrl2: string | null; InStock: number }[]) {
    (byProduct[row.ProductId] ||= []).push({ Id: row.Id, Name: row.Name, Hex: row.Hex, ImageUrl: row.ImageUrl, ImageUrl2: row.ImageUrl2, InStock: !!row.InStock });
  }
  for (const r of rows) r.Colors = byProduct[r.Id] || [];
  return rows;
}

export async function getActiveCategories(): Promise<StoreCategory[]> {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT c.Id, c.Name, c.Slug, c.ImageUrl, c.Description,
           (SELECT COUNT(*) FROM Products p WHERE p.CategoryId = c.Id AND p.IsActive = true) AS ProductCount
    FROM Categories c
    WHERE c.IsActive = true
    ORDER BY c.SortOrder, c.Name
  `);
  return res.recordset as StoreCategory[];
}

export async function getFeaturedProducts(limit = 8): Promise<StoreProduct[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("n", sql.Int, limit)
    .query(`${PRODUCT_SELECT} WHERE p.IsActive = true AND p.IsFeatured = true
            ORDER BY p.SortOrder, p.Name
            LIMIT @n OFFSET 0`);
  return attachColors(pool, res.recordset as StoreProduct[]);
}

/* Top few products per category — drives the Shop mega-menu preview that
   swaps as the customer hovers each category. One windowed query; no colours
   needed (just image/name/price), so it stays light. */
export type MegaProduct = {
  Id: string;
  Name: string;
  Slug: string;
  ImageUrl: string | null;
  SellingPrice: number;
  CompareAtPrice: number | null;
  CategoryId: string;
};

export async function getCategoryPreviews(perCat = 4): Promise<MegaProduct[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("n", sql.Int, perCat)
    .query(`
      SELECT Id, Name, Slug, ImageUrl, SellingPrice, CompareAtPrice, CategoryId FROM (
        SELECT p.Id, p.Name, p.Slug, p.ImageUrl, p.SellingPrice, p.CompareAtPrice, p.CategoryId,
               ROW_NUMBER() OVER (PARTITION BY p.CategoryId ORDER BY p.IsFeatured DESC, p.SortOrder, p.CreatedAt DESC) AS rn
        FROM Products p
        WHERE p.IsActive = true
      ) t WHERE rn <= @n
    `);
  return res.recordset as MegaProduct[];
}

export async function getDeals(limit = 8): Promise<StoreProduct[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("n", sql.Int, limit)
    .query(`${PRODUCT_SELECT}
            WHERE p.IsActive = true AND p.CompareAtPrice IS NOT NULL AND p.CompareAtPrice > p.SellingPrice
            ORDER BY (p.CompareAtPrice - p.SellingPrice) DESC
            LIMIT @n OFFSET 0`);
  return attachColors(pool, res.recordset as StoreProduct[]);
}

/* Admin-curated "New Collection" — products explicitly flagged IsNewArrival.
   Drives the homepage slider that sits right under the hero. */
export async function getNewArrivals(limit = 12): Promise<StoreProduct[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("n", sql.Int, limit)
    .query(`${PRODUCT_SELECT} WHERE p.IsActive = true AND p.IsNewArrival = true
            ORDER BY p.SortOrder, p.CreatedAt DESC
            LIMIT @n OFFSET 0`);
  return attachColors(pool, res.recordset as StoreProduct[]);
}

export async function getNewProducts(limit = 8): Promise<StoreProduct[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("n", sql.Int, limit)
    .query(`${PRODUCT_SELECT} WHERE p.IsActive = true
            ORDER BY p.CreatedAt DESC
            LIMIT @n OFFSET 0`);
  return attachColors(pool, res.recordset as StoreProduct[]);
}

/* Garments marked DTF-printable in the admin — drives the customer Customize page. */
export async function getDtfPrintableProducts(): Promise<StoreProduct[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .query(`${PRODUCT_SELECT} WHERE p.IsActive = true AND p.IsDtfPrintable = true
            ORDER BY p.SortOrder, p.Name`);
  return attachColors(pool, res.recordset as StoreProduct[]);
}

/* A single printable garment + its variants, for the Customize picker.
   `cost` is the product's own cost fallback; `dtfProfit` is the per-product DTF
   garment profit (null → use the global Profit). The DTF garment base is each
   variant's resolved (blank) CostPrice + that profit. Returns null if the
   product isn't active/printable. */
export async function getDtfGarment(
  productId: string
): Promise<{ product: StoreProduct; variants: StoreVariant[]; cost: number; dtfProfit: number | null } | null> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", sql.UniqueIdentifier, productId)
    .query(`${PRODUCT_SELECT.replace("FROM Products p", ", p.CostPrice AS BaseCost, p.DtfProfit AS DtfProfit FROM Products p")}
            WHERE p.Id = @pid AND p.IsActive = true AND p.IsDtfPrintable = true`);
  const row = res.recordset[0] as (StoreProduct & { BaseCost: number | null; DtfProfit: number | null }) | undefined;
  if (!row) return null;
  const rows = await attachColors(pool, [row] as StoreProduct[]);
  const variants = await getProductVariants(productId);
  return {
    product: rows[0],
    variants,
    cost: Number(row.BaseCost) || 0,
    dtfProfit: row.DtfProfit != null ? Number(row.DtfProfit) : null,
  };
}

/* ---------- Category by slug ---------- */
export async function getCategoryBySlug(slug: string): Promise<StoreCategory | null> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("slug", sql.NVarChar(150), slug)
    .query(`
      SELECT c.Id, c.Name, c.Slug, c.ImageUrl, c.Description,
             (SELECT COUNT(*) FROM Products p WHERE p.CategoryId = c.Id AND p.IsActive = true) AS ProductCount
      FROM Categories c WHERE c.Slug = @slug AND c.IsActive = true LIMIT 1
    `);
  return (res.recordset[0] as StoreCategory) || null;
}

/* ---------- Filter options ---------- */
export async function getFilterOptions() {
  const pool = await getDb();
  const [sizes, colors] = await Promise.all([
    pool.request().query(`SELECT Id, Name FROM Sizes ORDER BY Name`),
    pool.request().query(`SELECT Id, Name FROM Colors ORDER BY Name`),
  ]);
  return {
    sizes: sizes.recordset as { Id: string; Name: string }[],
    colors: colors.recordset as { Id: string; Name: string }[],
  };
}

/* ---------- Search / filtered listing ---------- */
export type ProductQuery = {
  q?: string;
  categorySlug?: string;
  sizeId?: string;
  colorId?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "new" | "price_asc" | "price_desc" | "deals";
};

export async function searchProducts(params: ProductQuery): Promise<StoreProduct[]> {
  const pool = await getDb();
  const req = pool.request();
  const where: string[] = ["p.IsActive = true"];

  if (params.q) {
    req.input("q", sql.NVarChar(200), `%${params.q}%`);
    where.push("(p.Name ILIKE @q OR p.Description ILIKE @q OR cat.Name ILIKE @q)");
  }
  if (params.categorySlug) {
    req.input("catSlug", sql.NVarChar(150), params.categorySlug);
    where.push("cat.Slug = @catSlug");
  }
  if (params.sizeId) {
    req.input("sizeId", sql.UniqueIdentifier, params.sizeId);
    where.push("EXISTS (SELECT 1 FROM ProductVariants v WHERE v.ProductId = p.Id AND v.SizeId = @sizeId AND v.Qty > 0)");
  }
  if (params.colorId) {
    req.input("colorId", sql.UniqueIdentifier, params.colorId);
    where.push("EXISTS (SELECT 1 FROM ProductVariants v WHERE v.ProductId = p.Id AND v.ColorId = @colorId AND v.Qty > 0)");
  }
  if (params.minPrice != null) {
    req.input("minP", sql.Decimal(18, 2), params.minPrice);
    where.push("p.SellingPrice >= @minP");
  }
  if (params.maxPrice != null) {
    req.input("maxP", sql.Decimal(18, 2), params.maxPrice);
    where.push("p.SellingPrice <= @maxP");
  }
  if (params.sort === "deals") {
    where.push("p.CompareAtPrice IS NOT NULL AND p.CompareAtPrice > p.SellingPrice");
  }

  let orderBy = "p.SortOrder, p.Name";
  if (params.sort === "price_asc") orderBy = "p.SellingPrice ASC";
  else if (params.sort === "price_desc") orderBy = "p.SellingPrice DESC";
  else if (params.sort === "new") orderBy = "p.CreatedAt DESC";
  else if (params.sort === "deals") orderBy = "(p.CompareAtPrice - p.SellingPrice) DESC";

  const res = await req.query(`${PRODUCT_SELECT} WHERE ${where.join(" AND ")} ORDER BY ${orderBy}`);
  return attachColors(pool, res.recordset as StoreProduct[]);
}

/* Lightweight type-ahead search for the header search drawer — matches product
   name, SKU, or category name (case-insensitive), no colours/joins overhead. */
export type LiteProduct = { Id: string; Name: string; Slug: string; ImageUrl: string | null; SellingPrice: number; CompareAtPrice: number | null };

export async function searchProductsLite(q: string, limit = 6): Promise<LiteProduct[]> {
  const term = (q || "").trim();
  if (term.length < 2) return [];
  const pool = await getDb();
  const res = await pool
    .request()
    .input("q", sql.NVarChar(200), `%${term}%`)
    .input("n", sql.Int, limit)
    .query(`
      SELECT p.Id, p.Name, p.Slug, p.ImageUrl, p.SellingPrice, p.CompareAtPrice
      FROM Products p
      LEFT JOIN Categories cat ON cat.Id = p.CategoryId
      WHERE p.IsActive = true AND (p.Name ILIKE @q OR p.SKU ILIKE @q OR cat.Name ILIKE @q)
      ORDER BY p.SortOrder, p.Name
      LIMIT @n
    `);
  return res.recordset as LiteProduct[];
}

/* ---------- Product detail (PDP) ---------- */
export type StoreProductDetail = StoreProduct & {
  Description: string | null;
  CategoryId: string | null;
  SizeChartUrl: string | null;
  SelectByImage: boolean;
  Images: string[];
};

export type StoreDesign = { VariantId: string; Image: string; Qty: number; Price: number };

export type StoreVariant = {
  VariantId: string;
  SizeId: string | null;
  SizeName: string | null;
  ColorId: string | null;
  ColorName: string | null;
  ColorHex: string | null;
  Qty: number;
  SellingPrice: number;
  CostPrice: number; // resolved to the blank's cost when linked (for DTF garment base)
};

export type ProductImagesByColor = {
  byColor: Record<string, string[]>; // colorId -> urls
  shared: string[]; // ColorId NULL urls (apply to all colours)
};

export async function getProductImagesByColor(productId: string): Promise<ProductImagesByColor> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", sql.UniqueIdentifier, productId)
    .query(`SELECT Url, ColorId FROM ProductImages WHERE ProductId=@pid ORDER BY SortOrder`);
  const byColor: Record<string, string[]> = {};
  const shared: string[] = [];
  for (const row of res.recordset as { Url: string; ColorId: string | null }[]) {
    if (row.ColorId) (byColor[row.ColorId] ||= []).push(row.Url);
    else shared.push(row.Url);
  }
  return { byColor, shared };
}

export async function getProductBySlug(slug: string): Promise<StoreProductDetail | null> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("slug", sql.NVarChar(250), slug)
    .query(`${PRODUCT_SELECT.replace("FROM Products p", ", p.Description, p.CategoryId, p.SizeChartUrl, p.SelectByImage FROM Products p")}
            WHERE p.Slug = @slug AND p.IsActive = true`);
  const row = res.recordset[0];
  if (!row) return null;

  const imgs = await pool
    .request()
    .input("pid", sql.UniqueIdentifier, row.Id)
    .query(`SELECT Url FROM ProductImages WHERE ProductId=@pid ORDER BY SortOrder`);

  const images = imgs.recordset.map((r: any) => r.Url as string);
  if (images.length === 0 && row.ImageUrl) images.push(row.ImageUrl);

  return { ...(row as StoreProduct), Description: row.Description, CategoryId: row.CategoryId, SizeChartUrl: row.SizeChartUrl, SelectByImage: !!row.SelectByImage, Images: images };
}

// Designs for a select-by-image product: each is a variant tied to its image,
// with blank-resolved stock. Ordered by the image SortOrder.
export async function getProductDesigns(productId: string): Promise<StoreDesign[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", sql.UniqueIdentifier, productId)
    .query(`
      SELECT v.Id AS VariantId, pi.Url AS Image,
             COALESCE((SELECT z.Qty FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(v.Id)), 0) AS Qty,
             COALESCE(v.SellingPrice, p.SellingPrice) AS Price
      FROM ProductImages pi
      JOIN ProductVariants v ON v.Id = pi.VariantId
      JOIN Products p ON p.Id = v.ProductId
      WHERE pi.ProductId = @pid
      ORDER BY pi.SortOrder
    `);
  return res.recordset as StoreDesign[];
}

export async function getProductVariants(productId: string): Promise<StoreVariant[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", sql.UniqueIdentifier, productId)
    .query(`
      SELECT v.Id AS VariantId, v.SizeId, s.Name AS SizeName,
             v.ColorId, c.Name AS ColorName, c.Hex AS ColorHex,
             COALESCE((SELECT z.Qty FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(v.Id)), 0) AS Qty,
             COALESCE(v.SellingPrice, p.SellingPrice) AS SellingPrice,
             COALESCE((SELECT z.CostPrice FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(v.Id)), COALESCE(v.CostPrice, p.CostPrice)) AS CostPrice
      FROM ProductVariants v
      JOIN Products p ON p.Id = v.ProductId
      LEFT JOIN Sizes s ON s.Id = v.SizeId
      LEFT JOIN Colors c ON c.Id = v.ColorId
      WHERE v.ProductId = @pid
      ORDER BY s.Name, c.Name
    `);
  return res.recordset as StoreVariant[];
}

export type QuickView = {
  product: {
    Id: string;
    Name: string;
    Slug: string;
    ImageUrl: string | null;
    SellingPrice: number;
    CompareAtPrice: number | null;
    CategoryName: string | null;
    Description: string | null;
    IsNewArrival: boolean;
  };
  images: ProductImagesByColor;
  variants: StoreVariant[];
};

export async function getQuickView(productId: string): Promise<QuickView | null> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", sql.UniqueIdentifier, productId)
    .query(`
      SELECT p.Id, p.Name, p.Slug, p.ImageUrl, p.SellingPrice, p.CompareAtPrice,
             p.Description, p.IsNewArrival, cat.Name AS CategoryName
      FROM Products p
      LEFT JOIN Categories cat ON cat.Id = p.CategoryId
      WHERE p.Id = @pid AND p.IsActive = true LIMIT 1
    `);
  const product = res.recordset[0];
  if (!product) return null;

  const [images, variants] = await Promise.all([
    getProductImagesByColor(productId),
    getProductVariants(productId),
  ]);
  if (images.shared.length === 0 && product.ImageUrl) images.shared = [product.ImageUrl];

  return { product, images, variants };
}

export async function getRelatedProducts(categoryId: string, excludeId: string, limit = 4): Promise<StoreProduct[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("cat", sql.UniqueIdentifier, categoryId)
    .input("ex", sql.UniqueIdentifier, excludeId)
    .input("n", sql.Int, limit)
    .query(`${PRODUCT_SELECT}
            WHERE p.IsActive = true AND p.CategoryId = @cat AND p.Id <> @ex
            ORDER BY gen_random_uuid()
            LIMIT @n OFFSET 0`);
  return attachColors(pool, res.recordset as StoreProduct[]);
}

/* ---------- Customer reviews ---------- */

export type StoreReview = {
  Id: string;
  ProductId: string;
  CustomerName: string;
  CustomerImage: string | null;
  Rating: number;
  Message: string;
  CreatedAt: string;
  ProductName?: string | null; // populated by category/home reads for linking
  ProductSlug?: string | null;
  Images: string[];
};

// Batched second query: review id -> ordered image urls (mirrors attachColors,
// avoiding an N+1 over ReviewImages).
async function attachReviewImages<T extends StoreReview>(
  pool: Awaited<ReturnType<typeof getDb>>,
  rows: T[]
): Promise<T[]> {
  rows.forEach((r) => (r.Images = []));
  if (rows.length === 0) return rows;
  const req = pool.request();
  const params = rows.map((r, i) => {
    req.input(`r${i}`, sql.UniqueIdentifier, r.Id);
    return `@r${i}`;
  });
  const res = await req.query(`
    SELECT ReviewId, Url FROM ReviewImages
    WHERE ReviewId IN (${params.join(",")})
    ORDER BY SortOrder, CreatedAt
  `);
  const byReview: Record<string, string[]> = {};
  for (const row of res.recordset as { ReviewId: string; Url: string }[]) {
    (byReview[row.ReviewId] ||= []).push(row.Url);
  }
  for (const r of rows) r.Images = byReview[r.Id] ?? [];
  return rows;
}

export async function getReviewsForProduct(productId: string): Promise<StoreReview[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", sql.UniqueIdentifier, productId)
    .query(`
      SELECT Id, ProductId, CustomerName, CustomerImage, Rating, Message, CreatedAt
      FROM Reviews
      WHERE ProductId = @pid AND IsPublished = true
      ORDER BY SortOrder, CreatedAt DESC
    `);
  return attachReviewImages(pool, res.recordset as StoreReview[]);
}

export async function getProductRatingSummary(productId: string): Promise<{ avg: number; count: number }> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", sql.UniqueIdentifier, productId)
    .query(`
      SELECT COALESCE(AVG(Rating::numeric), 0) AS avgrating, COUNT(*) AS cnt
      FROM Reviews WHERE ProductId = @pid AND IsPublished = true
    `);
  const row = res.recordset[0] as { avgrating: number | string; cnt: number | string } | undefined;
  return { avg: Number(row?.avgrating ?? 0), count: Number(row?.cnt ?? 0) };
}

export async function getReviewsByCategory(categorySlug: string): Promise<StoreReview[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("slug", sql.NVarChar(150), categorySlug)
    .query(`
      SELECT r.Id, r.ProductId, r.CustomerName, r.CustomerImage, r.Rating, r.Message, r.CreatedAt,
             p.Name AS ProductName, p.Slug AS ProductSlug
      FROM Reviews r
      JOIN Products p ON p.Id = r.ProductId
      JOIN Categories c ON c.Id = p.CategoryId
      WHERE c.Slug = @slug AND r.IsPublished = true
      ORDER BY r.SortOrder, r.CreatedAt DESC
    `);
  return attachReviewImages(pool, res.recordset as StoreReview[]);
}

export async function getLatestReviews(limit = 12): Promise<StoreReview[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("n", sql.Int, limit)
    .query(`
      SELECT r.Id, r.ProductId, r.CustomerName, r.CustomerImage, r.Rating, r.Message, r.CreatedAt,
             p.Name AS ProductName, p.Slug AS ProductSlug
      FROM Reviews r
      JOIN Products p ON p.Id = r.ProductId
      WHERE r.IsPublished = true
      ORDER BY r.SortOrder, r.CreatedAt DESC
      LIMIT @n OFFSET 0
    `);
  return attachReviewImages(pool, res.recordset as StoreReview[]);
}

/* ============================================================
   CUSTOM-ORDERS GALLERY (storefront reads)
   Each gallery item pairs the customer's submitted artwork with
   photos of the delivered product (GalleryImages child table).
   ============================================================ */

export type GalleryItem = {
  Id: string;
  CustomerName: string;
  ArtworkUrl: string | null;
  Caption: string | null;
  IsFeatured: boolean;
  CreatedAt: string;
  Images: string[]; // final product photos, ordered
};

// Batched second query: item id -> image urls (no N+1), mirrors attachReviewImages.
async function attachGalleryImages(
  pool: Awaited<ReturnType<typeof getDb>>,
  rows: GalleryItem[]
): Promise<GalleryItem[]> {
  rows.forEach((r) => (r.Images = []));
  if (rows.length === 0) return rows;
  const req = pool.request();
  const params = rows.map((r, i) => {
    req.input(`g${i}`, sql.UniqueIdentifier, r.Id);
    return `@g${i}`;
  });
  const res = await req.query(`
    SELECT GalleryItemId AS GalleryItemId, Url FROM GalleryImages
    WHERE GalleryItemId IN (${params.join(",")})
    ORDER BY SortOrder, CreatedAt
  `);
  const byItem: Record<string, string[]> = {};
  for (const row of res.recordset as { GalleryItemId: string; Url: string }[]) {
    (byItem[row.GalleryItemId] ||= []).push(row.Url);
  }
  for (const r of rows) r.Images = byItem[r.Id] ?? [];
  return rows;
}

const GALLERY_SELECT = `
  SELECT Id, CustomerName, ArtworkUrl AS ArtworkUrl, Caption AS Caption,
         IsFeatured, CreatedAt
  FROM GalleryItems
`;

export async function getLatestGalleryItems(limit = 6): Promise<GalleryItem[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("n", sql.Int, limit)
    .query(`
      ${GALLERY_SELECT}
      WHERE IsPublished = true
      ORDER BY IsFeatured DESC, SortOrder, CreatedAt DESC
      LIMIT @n OFFSET 0
    `);
  return attachGalleryImages(pool, res.recordset as GalleryItem[]);
}

// /gallery page: customer-name search + incremental "load more" cap.
export async function getGalleryItems(opts: { q?: string; limit: number }): Promise<{ items: GalleryItem[]; total: number }> {
  const pool = await getDb();
  const where = opts.q ? `WHERE IsPublished = true AND CustomerName ILIKE @q` : `WHERE IsPublished = true`;

  const countReq = pool.request();
  if (opts.q) countReq.input("q", sql.NVarChar(200), `%${opts.q}%`);
  const countRes = await countReq.query(`SELECT COUNT(*) AS cnt FROM GalleryItems ${where}`);
  const total = Number((countRes.recordset[0] as { cnt: number | string })?.cnt ?? 0);

  const req = pool.request().input("n", sql.Int, opts.limit);
  if (opts.q) req.input("q", sql.NVarChar(200), `%${opts.q}%`);
  const res = await req.query(`
    ${GALLERY_SELECT}
    ${where}
    ORDER BY IsFeatured DESC, SortOrder, CreatedAt DESC
    LIMIT @n OFFSET 0
  `);
  const items = await attachGalleryImages(pool, res.recordset as GalleryItem[]);
  return { items, total };
}
