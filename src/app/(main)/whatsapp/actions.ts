"use server";

import { requireAdmin } from "@/lib/adminAuth";

import { getDb } from "@/lib/db";
import { getSizesWithColorsForCategory } from "@/lib/waStock";

/**
 * Get all product categories
 */
export async function getProductCategories() {
  await requireAdmin();
  const pool = await getDb();
  const res = await pool.request().query(`
    SELECT Id, Name
    FROM Categories
    ORDER BY Name
  `);
  return (res.recordset ?? []) as { Id: string; Name: string }[];
}

/**
 * Get sizes with their available colors (qty > 0) for a specific category
 */
export async function getSizesWithColors(categoryId: string) {
  await requireAdmin();
  // Shared query lives in @/lib/waStock so the WhatsApp bot webhook can reuse it
  // without an admin session.
  return getSizesWithColorsForCategory(categoryId);
}
