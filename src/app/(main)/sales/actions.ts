"use server";

import { requireAdmin } from "@/lib/adminAuth";

import { getDb } from "@/lib/db";
import sql from "@/lib/sqlShim";
import { sortBySize } from "@/lib/sizeOrder";
import { UserFacingError, userErrorMessage } from "@/lib/userError";

export async function getLookups() {
  await requireAdmin();
  const pool = await getDb();
  const cats = await pool.request().query(`SELECT Id, Name FROM Categories ORDER BY Name`);
  return { categories: cats.recordset };
}

export async function getProductsByCategory(categoryId: string) {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool
    .request()
    .input("catId", sql.UniqueIdentifier, categoryId)
    .query(`SELECT Id, Name FROM Products WHERE CategoryId=@catId ORDER BY Name`);
  return res.recordset;
}

export async function getSizes(productId: string) {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", sql.UniqueIdentifier, productId)
    .query(`
      SELECT DISTINCT s.Id, s.Name
      FROM ProductVariants v
      JOIN Sizes s ON s.Id = v.SizeId
      WHERE v.ProductId=@pid
    `);
  return sortBySize(res.recordset as { Id: string; Name: string }[], (s) => s.Name);
}

export async function getVariantsByProductAndSize(productId: string, sizeId: string) {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool
    .request()
    .input("pid", sql.UniqueIdentifier, productId)
    .input("sid", sql.UniqueIdentifier, sizeId)
    .query(`
      SELECT v.Id, c.Name AS Color, s.Name AS Size, v.Qty, 
             COALESCE(v.SellingPrice, p.SellingPrice) AS SellingPrice
      FROM ProductVariants v
      JOIN Colors c ON c.Id = v.ColorId
      JOIN Sizes s ON s.Id = v.SizeId
      JOIN Products p ON p.Id = v.ProductId
      WHERE v.ProductId=@pid AND v.SizeId=@sid
      ORDER BY c.Name
    `);
  return res.recordset;
}

export async function sellStock(
  variantId: string,
  qty: number,
  sellingPrice: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const pool = await getDb();
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    // check stock — availability is OWN + blank (sell own first, overflow to blank)
    const check = await tx
      .request()
      .input("vid", sql.UniqueIdentifier, variantId)
      .query(`SELECT dbo.fn_available_qty(@vid) AS "Avail",
                     (SELECT 1 FROM ProductVariants WHERE Id=@vid) AS "Exists"`);
    if (!check.recordset[0]?.Exists) throw new UserFacingError("Variant not found");
    const inStock = Number(check.recordset[0]?.Avail ?? 0);
    if (inStock < qty) throw new UserFacingError(`Not enough stock. In stock: ${inStock}`);

    // real unit cost: prefer the resolved stock (blank) variant's own
    // CostPrice, else the product's, plus the product's Utilities
    const costRow = await tx
      .request()
      .input("vid", sql.UniqueIdentifier, variantId)
      .query(`
        SELECT COALESCE(
                 (SELECT z.CostPrice FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(v.Id)),
                 p.CostPrice, 0
               ) + COALESCE(p.Utilities, 0) AS UnitCost
        FROM ProductVariants v
        JOIN Products p ON p.Id = v.ProductId
        WHERE v.Id = @vid
      `);
    const unitCost = Number(costRow.recordset[0]?.UnitCost ?? 0);

    // insert sale (explicit Id so the stock deduction can be keyed to it)
    const saleId = crypto.randomUUID();
    await tx
      .request()
      .input("id", sql.UniqueIdentifier, saleId)
      .input("vid", sql.UniqueIdentifier, variantId)
      .input("qty", sql.Int, qty)
      .input("price", sql.Decimal(18, 2), sellingPrice)
      .input("cost", sql.Decimal(18, 2), unitCost)
      .query(`
        INSERT INTO Sales (Id, VariantId, Qty, SellingPrice, CostPrice)
        VALUES (@id, @vid, @qty, @price, @cost)
      `);

    // reduce stock — OWN first, overflow to the blank; atomic + re-checked under
    // a row lock so a concurrent sale can't take it below zero. Records the split.
    const d = await tx
      .request()
      .input("vid", sql.UniqueIdentifier, variantId)
      .input("qty", sql.Int, qty)
      .input("ref", sql.UniqueIdentifier, saleId)
      .query(`SELECT dbo.deduct_stock(@vid, @qty, @ref, 'sale', 'manual-sale') AS "Ok"`);
    if (!d.recordset[0]?.Ok) throw new UserFacingError("Not enough stock for this sale.");

    await tx.commit();
    return { ok: true };
  } catch (err) {
    await tx.rollback();
    const msg = userErrorMessage(err);
    if (msg) return { ok: false, error: msg };
    throw err;
  }
}

export async function recordBackfill(
  productId: string,
  date: string,
  qty: number,
  cost: number,
  selling: number
) {
  await requireAdmin();
  const pool = await getDb();

  // ensure hidden variant exists
  const hidden = await pool.request().input("pid", sql.UniqueIdentifier, productId).query(`
    SELECT v.Id
    FROM ProductVariants v
    WHERE v.ProductId=@pid
      AND v.SizeId IS NULL
      AND v.ColorId IS NULL LIMIT 1
  `);

  let variantId = hidden.recordset[0]?.Id;
  if (!variantId) {
    const ins = await pool
      .request()
      .input("pid", sql.UniqueIdentifier, productId)
      .query(`INSERT INTO ProductVariants (ProductId, SizeId, ColorId, Qty) VALUES (@pid, NULL, NULL, 0) RETURNING Id`);
    variantId = ins.recordset[0].Id;
  }

  // Insert a backfill "sale" (does not touch stock, only records history)
  await pool
    .request()
    .input("vid", sql.UniqueIdentifier, variantId)
    .input("qty", sql.Int, qty)
    .input("price", sql.Decimal(18, 2), selling)
    .input("cost", sql.Decimal(18, 2), cost)
    .input("date", sql.DateTime2, date)
    .query(`
      INSERT INTO Sales (VariantId, Qty, SellingPrice, CostPrice, SaleDate, PaymentMethod, PaymentStatus)
      VALUES (@vid, @qty, @price, @cost, @date, 'backfill', 'Paid')
    `);
}
