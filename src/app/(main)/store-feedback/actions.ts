"use server";

import { requireAdmin } from "@/lib/adminAuth";

import { getDb, sql } from "@/lib/db";

/* ============================================================
   CUSTOMER FEEDBACK WALL (admin CRUD)
   Each item is one customer-feedback screenshot (WhatsApp chat
   etc.) with an optional customer name. Bulk add creates one
   published item per uploaded screenshot.
   ============================================================ */

export type AdminFeedbackItem = {
  Id: string;
  CustomerName: string | null;
  ImageUrl: string;
  IsPublished: boolean;
  SortOrder: number;
  CreatedAt: string;
};

export async function getAdminFeedbackItems(): Promise<AdminFeedbackItem[]> {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT Id, CustomerName, ImageUrl, IsPublished, SortOrder, CreatedAt
    FROM FeedbackItems
    ORDER BY CASE WHEN SortOrder = 0 THEN 2147483647 ELSE SortOrder END, CreatedAt DESC
  `);
  return res.recordset as AdminFeedbackItem[];
}

// Bulk add: one published item per uploaded screenshot URL.
export async function addFeedbackItems(urls: string[]): Promise<{ added: number }> {
  await requireAdmin();
  const clean = urls.map((u) => u.trim()).filter(Boolean);
  if (clean.length === 0) throw new Error("Please upload at least one screenshot.");

  const pool = await getDb();
  for (const url of clean) {
    await pool
      .request()
      .input("ImageUrl", sql.NVarChar(1000), url)
      .query(`INSERT INTO FeedbackItems (ImageUrl) VALUES (@ImageUrl)`);
  }
  return { added: clean.length };
}

export type SaveFeedbackItemInput = {
  id: string;
  customerName: string;
  isPublished: boolean;
  sortOrder: number;
};

// Edit an existing item's name/flags (the screenshot itself is immutable —
// replace = delete + re-add).
export async function saveFeedbackItem(inp: SaveFeedbackItemInput): Promise<{ ok: true }> {
  await requireAdmin();
  const pool = await getDb();
  await pool
    .request()
    .input("Id", sql.UniqueIdentifier, inp.id)
    .input("CustomerName", sql.NVarChar(200), inp.customerName.trim() || null)
    .input("IsPublished", sql.Bit, inp.isPublished)
    .input("SortOrder", sql.Int, inp.sortOrder || 0)
    .query(`UPDATE FeedbackItems SET CustomerName=@CustomerName, IsPublished=@IsPublished, SortOrder=@SortOrder WHERE Id=@Id`);
  return { ok: true };
}

export async function deleteFeedbackItem(id: string): Promise<{ ok: true }> {
  await requireAdmin();
  const pool = await getDb();
  await pool.request().input("Id", sql.UniqueIdentifier, id).query(`DELETE FROM FeedbackItems WHERE Id=@Id`);
  return { ok: true };
}
