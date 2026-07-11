import { searchProducts, getFilterOptions, getActiveCategories, type ProductQuery } from "@/lib/storefront";
import ProductCard from "@/components/shop/ProductCard";
import ShopFilters from "@/components/shop/ShopFilters";
import GalleryBand from "@/components/shop/GalleryBand";
import PageLinks from "@/components/shop/PageLinks";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export const metadata = { title: "Shop" };

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const query: ProductQuery = {
    q: sp.q || undefined,
    categorySlug: sp.category || undefined,
    sizeId: sp.size || undefined,
    colorId: sp.color || undefined,
    minPrice: sp.min ? Number(sp.min) : undefined,
    maxPrice: sp.max ? Number(sp.max) : undefined,
    sort: (sp.sort as ProductQuery["sort"]) || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const [{ products, total }, options, categories] = await Promise.all([
    searchProducts(query),
    getFilterOptions(),
    getActiveCategories(),
  ]);

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {sp.q ? `Results for "${sp.q}"` : "All products"}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {total === 0 ? "0 products" : `Showing ${from}–${to} of ${total} product${total !== 1 ? "s" : ""}`}
      </p>

      <div className="grid lg:grid-cols-[220px_1fr] gap-8">
        <aside className="lg:sticky lg:top-24 h-max">
          <ShopFilters
            categories={categories.map((c) => ({ Slug: c.Slug, Name: c.Name }))}
            sizes={options.sizes}
            colors={options.colors}
          />
        </aside>

        <div>
          {products.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-lg">No products match your filters.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                {products.map((p) => <ProductCard key={p.Id} p={p} />)}
              </div>
              <PageLinks basePath="/shop" params={sp} page={page} pageSize={PAGE_SIZE} total={total} />
            </>
          )}
        </div>
      </div>

      <GalleryBand />
    </div>
  );
}
