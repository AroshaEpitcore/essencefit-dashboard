"use server";

import { getDb, sql } from "@/lib/db";

/* ============================================================
   CUSTOMER REVIEWS (admin CRUD)
   Each review is assigned to a product; the storefront derives
   the category via Products.CategoryId. Gallery photos live in
   the ReviewImages child table.
   ============================================================ */

export type AdminReview = {
  Id: string;
  ProductId: string;
  ProductName: string | null;
  CustomerName: string;
  CustomerImage: string | null;
  Rating: number;
  Message: string;
  IsPublished: boolean;
  SortOrder: number;
  CreatedAt: string;
  ImageCount: number;
};

export async function getAdminReviews(): Promise<AdminReview[]> {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT r.Id, r.ProductId, p.Name AS ProductName, r.CustomerName, r.CustomerImage,
           r.Rating, r.Message, r.IsPublished, r.SortOrder, r.CreatedAt,
           (SELECT COUNT(*) FROM ReviewImages ri WHERE ri.ReviewId = r.Id) AS ImageCount
    FROM Reviews r
    LEFT JOIN Products p ON p.Id = r.ProductId
    ORDER BY r.SortOrder, r.CreatedAt DESC
  `);
  return res.recordset as AdminReview[];
}

export type ReviewForEdit = {
  Id: string;
  ProductId: string;
  CustomerName: string;
  CustomerImage: string | null;
  Rating: number;
  Message: string;
  IsPublished: boolean;
  SortOrder: number;
  Images: string[];
};

export async function getReviewForEdit(id: string): Promise<ReviewForEdit | null> {
  const pool = await getDb();
  const r = await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`SELECT Id, ProductId, CustomerName, CustomerImage, Rating, Message, IsPublished, SortOrder
            FROM Reviews WHERE Id=@Id`);
  const review = r.recordset[0];
  if (!review) return null;
  const imgs = await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`SELECT Url FROM ReviewImages WHERE ReviewId=@Id ORDER BY SortOrder`);
  return { ...(review as Omit<ReviewForEdit, "Images">), Images: imgs.recordset.map((x: any) => x.Url as string) };
}

export type ReviewProductOption = { Id: string; Name: string; CategoryName: string };

export async function getReviewProductOptions(): Promise<ReviewProductOption[]> {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT p.Id, p.Name, COALESCE(cat.Name, '') AS CategoryName
    FROM Products p
    LEFT JOIN Categories cat ON cat.Id = p.CategoryId
    ORDER BY p.Name
  `);
  return res.recordset as ReviewProductOption[];
}

export type SaveReviewInput = {
  id?: string | null;
  productId: string;
  customerName: string;
  customerImage: string | null;
  rating: number;
  message: string;
  isPublished: boolean;
  sortOrder: number;
  images: string[];
};

export async function saveReview(inp: SaveReviewInput): Promise<{ id: string }> {
  if (!inp.productId) throw new Error("Please choose a product.");
  if (!inp.customerName.trim()) throw new Error("Please enter the customer name.");
  if (!inp.message.trim()) throw new Error("Please enter the review message.");

  const pool = await getDb();
  const rating = Math.min(5, Math.max(1, Math.round(inp.rating || 5)));
  let id = inp.id || null;

  if (id) {
    await pool
      .request()
      .input("Id", sql.UniqueIdentifier, id)
      .input("ProductId", sql.UniqueIdentifier, inp.productId)
      .input("CustomerName", sql.NVarChar(200), inp.customerName.trim())
      .input("CustomerImage", sql.NVarChar(1000), inp.customerImage)
      .input("Rating", sql.Int, rating)
      .input("Message", sql.NVarChar(sql.MAX), inp.message.trim())
      .input("IsPublished", sql.Bit, inp.isPublished)
      .input("SortOrder", sql.Int, inp.sortOrder || 0)
      .query(`UPDATE Reviews SET ProductId=@ProductId, CustomerName=@CustomerName, CustomerImage=@CustomerImage,
              Rating=@Rating, Message=@Message, IsPublished=@IsPublished, SortOrder=@SortOrder WHERE Id=@Id`);
  } else {
    const res = await pool
      .request()
      .input("ProductId", sql.UniqueIdentifier, inp.productId)
      .input("CustomerName", sql.NVarChar(200), inp.customerName.trim())
      .input("CustomerImage", sql.NVarChar(1000), inp.customerImage)
      .input("Rating", sql.Int, rating)
      .input("Message", sql.NVarChar(sql.MAX), inp.message.trim())
      .input("IsPublished", sql.Bit, inp.isPublished)
      .input("SortOrder", sql.Int, inp.sortOrder || 0)
      .query(`INSERT INTO Reviews (ProductId, CustomerName, CustomerImage, Rating, Message, IsPublished, SortOrder)
              VALUES (@ProductId, @CustomerName, @CustomerImage, @Rating, @Message, @IsPublished, @SortOrder)
              RETURNING Id`);
    id = res.recordset[0].Id as string;
  }

  // Replace the gallery images with the provided ordered set.
  await pool.request().input("Rid", sql.UniqueIdentifier, id).query(`DELETE FROM ReviewImages WHERE ReviewId=@Rid`);
  for (let i = 0; i < inp.images.length; i++) {
    await pool
      .request()
      .input("Rid", sql.UniqueIdentifier, id)
      .input("Url", sql.NVarChar(1000), inp.images[i])
      .input("Sort", sql.Int, i)
      .query(`INSERT INTO ReviewImages (ReviewId, Url, SortOrder) VALUES (@Rid, @Url, @Sort)`);
  }

  return { id: id! };
}

export async function deleteReview(id: string): Promise<{ ok: true }> {
  const pool = await getDb();
  await pool.request().input("Id", sql.UniqueIdentifier, id).query(`DELETE FROM ReviewImages WHERE ReviewId=@Id`);
  await pool.request().input("Id", sql.UniqueIdentifier, id).query(`DELETE FROM Reviews WHERE Id=@Id`);
  return { ok: true };
}
