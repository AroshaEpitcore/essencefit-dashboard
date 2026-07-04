"use server";

import { getDb, sql } from "@/lib/db";

/* ============================================================
   CUSTOM-ORDERS GALLERY (admin CRUD)
   Each item records a customer's order: the artwork the customer
   submitted and photos of the delivered product, both stored in
   the GalleryImages child table (Kind = 'artwork' | 'final').
   Featured items surface first on the home page.
   ============================================================ */

export type AdminGalleryItem = {
  Id: string;
  CustomerName: string;
  ArtworkUrl: string | null; // first artwork image (list thumbnail)
  Caption: string | null;
  IsFeatured: boolean;
  IsPublished: boolean;
  SortOrder: number;
  CreatedAt: string;
  ImageCount: number; // final product photos
  ArtworkCount: number;
};

export async function getAdminGalleryItems(): Promise<AdminGalleryItem[]> {
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT g.Id, g.CustomerName, g.Caption AS Caption,
           g.IsFeatured, g.IsPublished, g.SortOrder, g.CreatedAt,
           (SELECT gi.Url FROM GalleryImages gi WHERE gi.GalleryItemId = g.Id AND gi.Kind = 'artwork' ORDER BY gi.SortOrder LIMIT 1) AS ArtworkUrl,
           (SELECT COUNT(*) FROM GalleryImages gi WHERE gi.GalleryItemId = g.Id AND gi.Kind = 'final') AS ImageCount,
           (SELECT COUNT(*) FROM GalleryImages gi WHERE gi.GalleryItemId = g.Id AND gi.Kind = 'artwork') AS ArtworkCount
    FROM GalleryItems g
    ORDER BY g.IsFeatured DESC, g.SortOrder, g.CreatedAt DESC
  `);
  return res.recordset as AdminGalleryItem[];
}

export type GalleryItemForEdit = {
  Id: string;
  CustomerName: string;
  Caption: string | null;
  IsFeatured: boolean;
  IsPublished: boolean;
  SortOrder: number;
  Images: string[]; // final product photos, ordered
  Artworks: string[]; // customer's artwork images, ordered
};

export async function getGalleryItemForEdit(id: string): Promise<GalleryItemForEdit | null> {
  const pool = await getDb();
  const r = await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`SELECT Id, CustomerName, Caption AS Caption, IsFeatured, IsPublished, SortOrder
            FROM GalleryItems WHERE Id=@Id`);
  const item = r.recordset[0];
  if (!item) return null;
  const imgs = await pool
    .request()
    .input("Id", sql.UniqueIdentifier, id)
    .query(`SELECT Url, Kind FROM GalleryImages WHERE GalleryItemId=@Id ORDER BY SortOrder`);
  const rows = imgs.recordset as { Url: string; Kind: string }[];
  return {
    ...(item as Omit<GalleryItemForEdit, "Images" | "Artworks">),
    Images: rows.filter((x) => x.Kind !== "artwork").map((x) => x.Url),
    Artworks: rows.filter((x) => x.Kind === "artwork").map((x) => x.Url),
  };
}

export type SaveGalleryItemInput = {
  id?: string | null;
  customerName: string;
  artworks: string[];
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
      .input("Caption", sql.NVarChar(sql.MAX), caption)
      .input("IsFeatured", sql.Bit, inp.isFeatured)
      .input("IsPublished", sql.Bit, inp.isPublished)
      .input("SortOrder", sql.Int, inp.sortOrder || 0)
      .query(`UPDATE GalleryItems SET CustomerName=@CustomerName, Caption=@Caption,
              IsFeatured=@IsFeatured, IsPublished=@IsPublished, SortOrder=@SortOrder WHERE Id=@Id`);
  } else {
    const res = await pool
      .request()
      .input("CustomerName", sql.NVarChar(200), inp.customerName.trim())
      .input("Caption", sql.NVarChar(sql.MAX), caption)
      .input("IsFeatured", sql.Bit, inp.isFeatured)
      .input("IsPublished", sql.Bit, inp.isPublished)
      .input("SortOrder", sql.Int, inp.sortOrder || 0)
      .query(`INSERT INTO GalleryItems (CustomerName, Caption, IsFeatured, IsPublished, SortOrder)
              VALUES (@CustomerName, @Caption, @IsFeatured, @IsPublished, @SortOrder)
              RETURNING Id`);
    id = res.recordset[0].Id as string;
  }

  // Replace both ordered image sets (final product photos + artworks).
  await pool.request().input("Gid", sql.UniqueIdentifier, id).query(`DELETE FROM GalleryImages WHERE GalleryItemId=@Gid`);
  const insert = async (url: string, kind: "final" | "artwork", sort: number) => {
    await pool
      .request()
      .input("Gid", sql.UniqueIdentifier, id)
      .input("Url", sql.NVarChar(1000), url)
      .input("Kind", sql.NVarChar(20), kind)
      .input("Sort", sql.Int, sort)
      .query(`INSERT INTO GalleryImages (GalleryItemId, Url, Kind, SortOrder) VALUES (@Gid, @Url, @Kind, @Sort)`);
  };
  for (let i = 0; i < inp.images.length; i++) await insert(inp.images[i], "final", i);
  for (let i = 0; i < inp.artworks.length; i++) await insert(inp.artworks[i], "artwork", i);

  return { id: id! };
}

export async function deleteGalleryItem(id: string): Promise<{ ok: true }> {
  const pool = await getDb();
  await pool.request().input("Id", sql.UniqueIdentifier, id).query(`DELETE FROM GalleryImages WHERE GalleryItemId=@Id`);
  await pool.request().input("Id", sql.UniqueIdentifier, id).query(`DELETE FROM GalleryItems WHERE Id=@Id`);
  return { ok: true };
}
