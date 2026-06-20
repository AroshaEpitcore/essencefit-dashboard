import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getFeaturedProducts, getDeals, getActiveCategories, getNewProducts } from "@/lib/storefront";
import { getPublicStoreSettings } from "@/lib/storeSettings";
import ProductCard from "@/components/shop/ProductCard";
import HeroCarousel from "@/components/shop/HeroCarousel";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, categories, featured, deals, latest] = await Promise.all([
    getPublicStoreSettings(),
    getActiveCategories(),
    getFeaturedProducts(8),
    getDeals(8),
    getNewProducts(8),
  ]);

  return (
    <div>
      <HeroCarousel slides={settings.heroSlides} storeName={settings.storeName} />

      {/* Categories */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-10">
          <h2 className="text-xl font-bold text-gray-900 mb-5">Shop by category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {categories.map((c) => (
              <Link key={c.Id} href={`/category/${c.Slug}`} className="group text-center">
                <div className="aspect-square rounded-full overflow-hidden bg-gray-100 mb-2">
                  {c.ImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.ImageUrl} alt={c.Name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">{c.Name}</div>
                  )}
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-primary">{c.Name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {deals.length > 0 && <ProductRow title="🔥 Deals" href="/deals" products={deals} />}
      {featured.length > 0 && <ProductRow title="Featured" href="/shop" products={featured} />}
      {latest.length > 0 && <ProductRow title="New arrivals" href="/shop" products={latest} />}

      {featured.length === 0 && deals.length === 0 && latest.length === 0 && (
        <div className="max-w-7xl mx-auto px-4 py-20 text-center text-gray-500">
          <p className="text-lg">No products published yet.</p>
          <p className="text-sm mt-1">Mark products as active in the admin Storefront Catalog.</p>
        </div>
      )}
    </div>
  );
}

function ProductRow({ title, href, products }: { title: string; href: string; products: any[] }) {
  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <Link href={href} className="text-sm font-medium text-primary flex items-center gap-1 hover:gap-2 transition-all">
          View all <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {products.map((p) => (
          <ProductCard key={p.Id} p={p} />
        ))}
      </div>
    </section>
  );
}
