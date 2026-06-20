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
    p.Id, p.Name, p.Slug, p.ImageUrl, p.SellingPrice, p.CompareAtPrice,
    cat.Name AS CategoryName, cat.Slug AS CategorySlug,
    ISNULL((SELECT SUM(v.Qty) FROM ProductVariants v WHERE v.ProductId = p.Id), 0) AS Stock,
    (SELECT TOP 1 pi.Url FROM ProductImages pi
       WHERE pi.ProductId = p.Id AND (p.ImageUrl IS NULL OR pi.Url <> p.ImageUrl)
       ORDER BY CASE WHEN pi.ColorId IS NULL THEN 0 ELSE 1 END, pi.SortOrder) AS HoverImageUrl
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
      (SELECT TOP 1 pi.Url FROM ProductImages pi
         WHERE pi.ProductId = v.ProductId AND pi.ColorId = c.Id ORDER BY pi.SortOrder) AS ImageUrl,
      (SELECT pi.Url FROM ProductImages pi
         WHERE pi.ProductId = v.ProductId AND pi.ColorId = c.Id
         ORDER BY pi.SortOrder OFFSET 1 ROWS FETCH NEXT 1 ROWS ONLY) AS ImageUrl2,
      ISNULL((SELECT MIN(pi.SortOrder) FROM ProductImages pi
         WHERE pi.ProductId = v.ProductId AND pi.ColorId = c.Id), 2147483647) AS ImgSort,
      MAX(CASE WHEN v.Qty > 0 THEN 1 ELSE 0 END) AS InStock
    FROM ProductVariants v
    JOIN Colors c ON c.Id = v.ColorId
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
           (SELECT COUNT(*) FROM Products p WHERE p.CategoryId = c.Id AND p.IsActive = 1) AS ProductCount
    FROM Categories c
    WHERE c.IsActive = 1
    ORDER BY c.SortOrder, c.Name
  `);
  return res.recordset as StoreCategory[];
}

export async function getFeaturedProducts(limit = 8): Promise<StoreProduct[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("n", sql.Int, limit)
    .query(`${PRODUCT_SELECT} WHERE p.IsActive = 1 AND p.IsFeatured = 1
            ORDER BY p.SortOrder, p.Name
            OFFSET 0 ROWS FETCH NEXT @n ROWS ONLY`);
  return attachColors(pool, res.recordset as StoreProduct[]);
}

export async function getDeals(limit = 8): Promise<StoreProduct[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("n", sql.Int, limit)
    .query(`${PRODUCT_SELECT}
            WHERE p.IsActive = 1 AND p.CompareAtPrice IS NOT NULL AND p.CompareAtPrice > p.SellingPrice
            ORDER BY (p.CompareAtPrice - p.SellingPrice) DESC
            OFFSET 0 ROWS FETCH NEXT @n ROWS ONLY`);
  return attachColors(pool, res.recordset as StoreProduct[]);
}

/* Admin-curated "New Collection" — products explicitly flagged IsNewArrival.
   Drives the homepage slider that sits right under the hero. */
export async function getNewArrivals(limit = 12): Promise<StoreProduct[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("n", sql.Int, limit)
    .query(`${PRODUCT_SELECT} WHERE p.IsActive = 1 AND p.IsNewArrival = 1
            ORDER BY p.SortOrder, p.CreatedAt DESC
            OFFSET 0 ROWS FETCH NEXT @n ROWS ONLY`);
  return attachColors(pool, res.recordset as StoreProduct[]);
}

export async function getNewProducts(limit = 8): Promise<StoreProduct[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("n", sql.Int, limit)
    .query(`${PRODUCT_SELECT} WHERE p.IsActive = 1
            ORDER BY p.CreatedAt DESC
            OFFSET 0 ROWS FETCH NEXT @n ROWS ONLY`);
  return attachColors(pool, res.recordset as StoreProduct[]);
}

/* Garments marked DTF-printable in the admin — drives the customer Customize page. */
export async function getDtfPrintableProducts(): Promise<StoreProduct[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .query(`${PRODUCT_SELECT} WHERE p.IsActive = 1 AND p.IsDtfPrintable = 1
            ORDER BY p.SortOrder, p.Name`);
  return attachColors(pool, res.recordset as StoreProduct[]);
}

/* A single printable garment + its variants, for the Customize picker.
   Returns null if the product isn't active/printable. */
export async function getDtfGarment(productId: string): Promise<{ product: StoreProduct; variants: StoreVariant[] } | null> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", sql.UniqueIdentifier, productId)
    .query(`${PRODUCT_SELECT} WHERE p.Id = @pid AND p.IsActive = 1 AND p.IsDtfPrintable = 1`);
  const rows = await attachColors(pool, res.recordset as StoreProduct[]);
  if (!rows[0]) return null;
  const variants = await getProductVariants(productId);
  return { product: rows[0], variants };
}

/* ---------- Category by slug ---------- */
export async function getCategoryBySlug(slug: string): Promise<StoreCategory | null> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("slug", sql.NVarChar(150), slug)
    .query(`
      SELECT TOP 1 c.Id, c.Name, c.Slug, c.ImageUrl, c.Description,
             (SELECT COUNT(*) FROM Products p WHERE p.CategoryId = c.Id AND p.IsActive = 1) AS ProductCount
      FROM Categories c WHERE c.Slug = @slug AND c.IsActive = 1
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
  const where: string[] = ["p.IsActive = 1"];

  if (params.q) {
    req.input("q", sql.NVarChar(200), `%${params.q}%`);
    where.push("(p.Name LIKE @q OR p.Description LIKE @q)");
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

/* ---------- Product detail (PDP) ---------- */
export type StoreProductDetail = StoreProduct & {
  Description: string | null;
  CategoryId: string | null;
  Images: string[];
};

export type StoreVariant = {
  VariantId: string;
  SizeId: string | null;
  SizeName: string | null;
  ColorId: string | null;
  ColorName: string | null;
  ColorHex: string | null;
  Qty: number;
  SellingPrice: number;
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
    .query(`${PRODUCT_SELECT.replace("FROM Products p", ", p.Description, p.CategoryId FROM Products p")}
            WHERE p.Slug = @slug AND p.IsActive = 1`);
  const row = res.recordset[0];
  if (!row) return null;

  const imgs = await pool
    .request()
    .input("pid", sql.UniqueIdentifier, row.Id)
    .query(`SELECT Url FROM ProductImages WHERE ProductId=@pid ORDER BY SortOrder`);

  const images = imgs.recordset.map((r: any) => r.Url as string);
  if (images.length === 0 && row.ImageUrl) images.push(row.ImageUrl);

  return { ...(row as StoreProduct), Description: row.Description, CategoryId: row.CategoryId, Images: images };
}

export async function getProductVariants(productId: string): Promise<StoreVariant[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", sql.UniqueIdentifier, productId)
    .query(`
      SELECT v.Id AS VariantId, v.SizeId, s.Name AS SizeName,
             v.ColorId, c.Name AS ColorName, c.Hex AS ColorHex, v.Qty,
             ISNULL(v.SellingPrice, p.SellingPrice) AS SellingPrice
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
      SELECT TOP 1 p.Id, p.Name, p.Slug, p.ImageUrl, p.SellingPrice, p.CompareAtPrice,
             p.Description, cat.Name AS CategoryName
      FROM Products p
      LEFT JOIN Categories cat ON cat.Id = p.CategoryId
      WHERE p.Id = @pid AND p.IsActive = 1
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
            WHERE p.IsActive = 1 AND p.CategoryId = @cat AND p.Id <> @ex
            ORDER BY NEWID()
            OFFSET 0 ROWS FETCH NEXT @n ROWS ONLY`);
  return attachColors(pool, res.recordset as StoreProduct[]);
}
