import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, priority: 1 },
    { url: `${BASE}/shop`, priority: 0.9 },
    { url: `${BASE}/deals`, priority: 0.8 },
  ];

  try {
    const pool = await getDb();
    const [products, categories] = await Promise.all([
      pool.request().query(`SELECT Slug FROM Products WHERE IsActive = 1 AND Slug IS NOT NULL`),
      pool.request().query(`SELECT Slug FROM Categories WHERE IsActive = 1 AND Slug IS NOT NULL`),
    ]);
    for (const c of categories.recordset) staticUrls.push({ url: `${BASE}/category/${c.Slug}`, priority: 0.7 });
    for (const p of products.recordset) staticUrls.push({ url: `${BASE}/product/${p.Slug}`, priority: 0.6 });
  } catch {
    /* DB unavailable at build — return static only */
  }

  return staticUrls;
}
