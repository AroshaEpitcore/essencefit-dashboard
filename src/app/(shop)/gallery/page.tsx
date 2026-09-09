import type { Metadata } from "next";
import Link from "next/link";
import { getGalleryItems } from "@/lib/storefront";
import GalleryGrid from "@/components/shop/GalleryGrid";
import GallerySearch from "@/components/shop/GallerySearch";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: "Custom Orders Gallery",
  description:
    "Real custom orders we've delivered — customer-submitted artwork turned into premium DTF-printed apparel, made in Sri Lanka.",
  alternates: { canonical: "/gallery" },
};

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;

  // First page only — subsequent pages stream in via infinite scroll.
  const { items, total } = await getGalleryItems({ q, limit: PAGE_SIZE });

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Custom Orders Gallery</h1>
      <p className="text-sm text-gray-500 mb-6">
        Real orders, real customers — their artwork, our print.
      </p>

      {/* Customer-name search — live (debounced) as you type, server-filtered */}
      <GallerySearch initialQ={q || ""} />

      {items.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">{q ? `No orders found for "${q}".` : "No gallery items yet — check back soon."}</p>
          {q && (
            <Link href="/gallery" className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">
              Clear search
            </Link>
          )}
        </div>
      ) : (
        <GalleryGrid
          key={q || "all"}
          initialItems={items}
          total={total}
          q={q}
          autoOpenId={sp.item}
        />
      )}
    </div>
  );
}
