import type { Metadata } from "next";
import Link from "next/link";
import { getGalleryItems } from "@/lib/storefront";
import GalleryCard from "@/components/shop/GalleryCard";
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
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {items.map((item) => (
              <GalleryCard key={item.Id} item={item} shareable autoOpen={sp.item === item.Id} />
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
