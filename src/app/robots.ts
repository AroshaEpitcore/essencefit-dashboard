import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep admin & customer-private areas out of search indexes
      disallow: [
        "/dashboard", "/orders", "/web-orders", "/catalog", "/store-settings",
        "/settings", "/finance", "/expenses", "/reports", "/users", "/dtf",
        "/inventory", "/stocks", "/suppliers", "/customers", "/account",
        "/login", "/register", "/checkout", "/cart",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
