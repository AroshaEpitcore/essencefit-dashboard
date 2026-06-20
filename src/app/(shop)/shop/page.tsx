import { searchProducts, getFilterOptions, getActiveCategories, type ProductQuery } from "@/lib/storefront";
import ProductCard from "@/components/shop/ProductCard";
import ShopFilters from "@/components/shop/ShopFilters";

export const dynamic = "force-dynamic";

export const metadata = { title: "Shop | EssenceFit" };

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query: ProductQuery = {
    q: sp.q || undefined,
    categorySlug: sp.category || undefined,
    sizeId: sp.size || undefined,
    colorId: sp.color || undefined,
    minPrice: sp.min ? Number(sp.min) : undefined,
    maxPrice: sp.max ? Number(sp.max) : undefined,
    sort: (sp.sort as ProductQuery["sort"]) || undefined,
  };

  const [products, options, categories] = await Promise.all([
    searchProducts(query),
    getFilterOptions(),
    getActiveCategories(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {sp.q ? `Results for "${sp.q}"` : "All products"}
      </h1>
      <p className="text-sm text-gray-500 mb-6">{products.length} product{products.length !== 1 ? "s" : ""}</p>

      <div className="grid lg:grid-cols-[220px_1fr] gap-8">
        <aside className="lg:sticky lg:top-24 h-max bg-gray-50 rounded-xl p-4 border border-gray-200">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => <ProductCard key={p.Id} p={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
