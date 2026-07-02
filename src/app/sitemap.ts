import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";

const BASE = SITE_URL;

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, priority: 1, changeFrequency: "daily" },
    { url: `${BASE}/shop`, priority: 0.9, changeFrequency: "daily" },
    { url: `${BASE}/deals`, priority: 0.8, changeFrequency: "daily" },
    { url: `${BASE}/customize`, priority: 0.6, changeFrequency: "weekly" },
  ];

  try {
    const pool = await getDb();
    const [products, categories] = await Promise.all([
      pool.request().query(`SELECT Slug, CreatedAt FROM Products WHERE IsActive = true AND Slug IS NOT NULL`),
      pool.request().query(`SELECT Slug, CreatedAt FROM Categories WHERE IsActive = true AND Slug IS NOT NULL`),
    ]);
    for (const c of categories.recordset)
      staticUrls.push({
        url: `${BASE}/category/${c.Slug}`,
        priority: 0.7,
        changeFrequency: "weekly",
        lastModified: c.CreatedAt ? new Date(c.CreatedAt) : undefined,
      });
    for (const p of products.recordset)
      staticUrls.push({
        url: `${BASE}/product/${p.Slug}`,
        priority: 0.6,
        changeFrequency: "weekly",
        lastModified: p.CreatedAt ? new Date(p.CreatedAt) : undefined,
      });
  } catch {
    /* DB unavailable at build — return static only */
  }

  return staticUrls;
}
