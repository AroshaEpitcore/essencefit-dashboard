/* Shared SEO helpers — one source of truth for the site URL, auto-generated
   meta descriptions (used when a product/category has no hand-written one),
   and JSON-LD builders. Keeps metadata consistent without needing new DB
   columns: everything here derives from data that already exists. */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://essencefits.com").replace(/\/+$/, "");
export const SITE_NAME = "EssenceFit";

export function absoluteUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/* Meta descriptions want ~150-160 chars. A hand-written product/category
   description is used as-is (trimmed to length); anything too short or
   missing falls back to a templated line built from data we already have. */
function fit(text: string, max = 160): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

export function buildProductDescription(name: string, categoryName: string | null, description: string | null): string {
  if (description && description.trim().length >= 40) return fit(description);
  const cat = categoryName ? ` from our ${categoryName} collection` : "";
  return fit(`Shop ${name}${cat} at ${SITE_NAME}. Premium quality apparel with island-wide delivery across Sri Lanka.`);
}

export function buildCategoryDescription(name: string, description: string | null, productCount: number): string {
  if (description && description.trim().length >= 40) return fit(description);
  const count = productCount > 0 ? `${productCount} product${productCount !== 1 ? "s" : ""} — ` : "";
  return fit(`Shop ${name} at ${SITE_NAME}. ${count}island-wide delivery across Sri Lanka.`);
}

export type JsonLd = Record<string, unknown>;

export function organizationJsonLd(input: { storeName: string; logo?: string; contactPhone?: string; sameAs?: string[] }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.storeName,
    url: SITE_URL,
    ...(input.logo ? { logo: absoluteUrl(input.logo) } : {}),
    ...(input.contactPhone ? { telephone: input.contactPhone } : {}),
    ...(input.sameAs?.length ? { sameAs: input.sameAs } : {}),
  };
}

export function websiteJsonLd(storeName: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: storeName,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/shop?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

export function productJsonLd(input: {
  name: string;
  slug: string;
  description: string;
  images: string[];
  sellingPrice: number;
  inStock: boolean;
  rating?: { avg: number; count: number } | null;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    image: input.images.map(absoluteUrl).filter(Boolean),
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/product/${input.slug}`,
      priceCurrency: "LKR",
      price: input.sellingPrice,
      availability: input.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(input.rating && input.rating.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: input.rating.avg,
            reviewCount: input.rating.count,
          },
        }
      : {}),
  };
}
