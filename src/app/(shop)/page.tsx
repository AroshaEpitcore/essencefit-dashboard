import { getFeaturedProducts, getDeals, getActiveCategories, getNewProducts, getNewArrivals } from "@/lib/storefront";
import { getPublicStoreSettings } from "@/lib/storeSettings";
import ProductSlider from "@/components/shop/ProductSlider";
import CategorySlider from "@/components/shop/CategorySlider";
import Hero from "@/components/shop/Hero";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, categories, featured, deals, latest, newArrivals] = await Promise.all([
    getPublicStoreSettings(),
    getActiveCategories(),
    getFeaturedProducts(8),
    getDeals(8),
    getNewProducts(8),
    getNewArrivals(12),
  ]);

  return (
    <div>
      <Hero slides={settings.heroSlides} storeName={settings.storeName} />

      {/* New Collection slider — admin-curated via the "New" flag in Storefront Catalog */}
      <ProductSlider products={newArrivals} title="New Arrivals" href="/shop?sort=new" />

      {/* Categories — large black image tiles */}
      <CategorySlider categories={categories} title="Shop by Category" />

      {deals.length > 0 && <ProductSlider title="🔥 Deals" href="/deals" products={deals} />}
      {featured.length > 0 && <ProductSlider title="Featured" href="/shop" products={featured} />}
      {latest.length > 0 && <ProductSlider title="Just In" href="/shop?sort=new" products={latest} />}

      {featured.length === 0 && deals.length === 0 && latest.length === 0 && (
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-20 text-center text-gray-500">
          <p className="text-lg">No products published yet.</p>
          <p className="text-sm mt-1">Mark products as active in the admin Storefront Catalog.</p>
        </div>
      )}
    </div>
  );
}
