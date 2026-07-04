import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { getGalleryItems } from "@/lib/storefront";
import GalleryCard from "@/components/shop/GalleryCard";

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
  // Cap the user-controllable limit so a crafted ?show= can't force an
  // unbounded LIMIT + oversized IN(...) in attachGalleryImages.
  const show = Math.min(120, Math.max(PAGE_SIZE, Number(sp.show) || PAGE_SIZE));

  const { items, total } = await getGalleryItems({ q, limit: show });

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Custom Orders Gallery</h1>
      <p className="text-sm text-gray-500 mb-6">
        Real orders, real customers — their artwork, our print.
      </p>

      {/* Customer-name search (plain GET form, server-filtered) */}
      <form method="GET" action="/gallery" className="relative max-w-sm mb-8">
        <input
          type="text"
          name="q"
          defaultValue={q || ""}
          placeholder="Search by customer name..."
          className="w-full bg-gray-100 rounded-lg pl-4 pr-10 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button type="submit" aria-label="Search" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
          <Search className="w-4 h-4" />
        </button>
      </form>

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
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {items.map((item) => (
              <GalleryCard key={item.Id} item={item} />
            ))}
          </div>

          {items.length < total && (
            <div className="mt-10 text-center">
              <Link
                href={`/gallery?${new URLSearchParams({ ...(q ? { q } : {}), show: String(show + PAGE_SIZE) }).toString()}`}
                scroll={false}
                className="inline-block rounded-lg border border-gray-900 text-gray-900 font-semibold px-6 py-3 hover:bg-gray-900 hover:text-white transition-colors"
              >
                Load more ({total - items.length} remaining)
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
