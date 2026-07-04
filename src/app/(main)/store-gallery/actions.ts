"use server";

import { getDb, sql } from "@/lib/db";

/* ============================================================
   CUSTOM-ORDERS GALLERY (admin CRUD)
   Each item records a customer's order: the artwork they sent
   (ArtworkUrl) and photos of the delivered product in the
   GalleryImages child table. Featured items surface first on
   the home page.
   ============================================================ */

export type AdminGalleryItem = {
  Id: string;
  CustomerName: string;
  ArtworkUrl: string | null;
  Caption: string | null;
  IsFeatured: boolean;
  IsPublished: boolean;
  SortOrder: number;
  CreatedAt: string;
  ImageCount: number;
};

export async function getAdminGalleryItems(): Promise<AdminGalleryItem[]> {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT g.Id, g.CustomerName, g.ArtworkUrl AS ArtworkUrl, g.Caption AS Caption,
           g.IsFeatured, g.IsPublished, g.SortOrder, g.CreatedAt,
           (SELECT COUNT(*) FROM GalleryImages gi WHERE gi.GalleryItemId = g.Id) AS ImageCount
    FROM GalleryItems g
    ORDER BY g.IsFeatured DESC, g.SortOrder, g.CreatedAt DESC
  `);
  return res.recordset as AdminGalleryItem[];
}

export type GalleryItemForEdit = {
  Id: string;
  CustomerName: string;
  ArtworkUrl: string | null;
  Caption: string | null;
  IsFeatured: boolean;
  IsPublished: boolean;
  SortOrder: number;
  Images: string[];
};

export async function getGalleryItemForEdit(id: string): Promise<GalleryItemForEdit | null> {
  const pool = await getDb();
  const r = await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`SELECT Id, CustomerName, ArtworkUrl AS ArtworkUrl, Caption AS Caption,
                   IsFeatured, IsPublished, SortOrder
            FROM GalleryItems WHERE Id=@Id`);
  const item = r.recordset[0];
  if (!item) return null;
  const imgs = await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`SELECT Url FROM GalleryImages WHERE GalleryItemId=@Id ORDER BY SortOrder`);
  return { ...(item as Omit<GalleryItemForEdit, "Images">), Images: imgs.recordset.map((x: { Url: string }) => x.Url) };
}

export type SaveGalleryItemInput = {
  id?: string | null;
  customerName: string;
  artworkUrl: string | null;
  caption: string | null;
  isFeatured: boolean;
  isPublished: boolean;
  sortOrder: number;
  images: string[];
};

export async function saveGalleryItem(inp: SaveGalleryItemInput): Promise<{ id: string }> {
  if (!inp.customerName.trim()) throw new Error("Please enter the customer name.");
  if (inp.images.length === 0) throw new Error("Please add at least one final product image.");

  const pool = await getDb();
  const caption = inp.caption?.trim() || null;
  let id = inp.id || null;

  if (id) {
    await pool
      .request()
      .input("Id", sql.UniqueIdentifier, id)
      .input("CustomerName", sql.NVarChar(200), inp.customerName.trim())
      .input("ArtworkUrl", sql.NVarChar(1000), inp.artworkUrl)
      .input("Caption", sql.NVarChar(sql.MAX), caption)
      .input("IsFeatured", sql.Bit, inp.isFeatured)
      .input("IsPublished", sql.Bit, inp.isPublished)
      .input("SortOrder", sql.Int, inp.sortOrder || 0)
      .query(`UPDATE GalleryItems SET CustomerName=@CustomerName, ArtworkUrl=@ArtworkUrl, Caption=@Caption,
              IsFeatured=@IsFeatured, IsPublished=@IsPublished, SortOrder=@SortOrder WHERE Id=@Id`);
  } else {
    const res = await pool
      .request()
      .input("CustomerName", sql.NVarChar(200), inp.customerName.trim())
      .input("ArtworkUrl", sql.NVarChar(1000), inp.artworkUrl)
      .input("Caption", sql.NVarChar(sql.MAX), caption)
      .input("IsFeatured", sql.Bit, inp.isFeatured)
      .input("IsPublished", sql.Bit, inp.isPublished)
      .input("SortOrder", sql.Int, inp.sortOrder || 0)
      .query(`INSERT INTO GalleryItems (CustomerName, ArtworkUrl, Caption, IsFeatured, IsPublished, SortOrder)
              VALUES (@CustomerName, @ArtworkUrl, @Caption, @IsFeatured, @IsPublished, @SortOrder)
              RETURNING Id`);
    id = res.recordset[0].Id as string;
  }

  // Replace the final-product images with the provided ordered set.
  await pool.request().input("Gid", sql.UniqueIdentifier, id).query(`DELETE FROM GalleryImages WHERE GalleryItemId=@Gid`);
  for (let i = 0; i < inp.images.length; i++) {
    await pool
      .request()
      .input("Gid", sql.UniqueIdentifier, id)
      .input("Url", sql.NVarChar(1000), inp.images[i])
      .input("Sort", sql.Int, i)
      .query(`INSERT INTO GalleryImages (GalleryItemId, Url, SortOrder) VALUES (@Gid, @Url, @Sort)`);
  }

  return { id: id! };
}

export async function deleteGalleryItem(id: string): Promise<{ ok: true }> {
  const pool = await getDb();
  await pool.request().input("Id", sql.UniqueIdentifier, id).query(`DELETE FROM GalleryImages WHERE GalleryItemId=@Id`);
  await pool.request().input("Id", sql.UniqueIdentifier, id).query(`DELETE FROM GalleryItems WHERE Id=@Id`);
  return { ok: true };
}
