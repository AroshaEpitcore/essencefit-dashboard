import type { Metadata } from "next";
import { getFeaturedProducts, getDeals, getActiveCategories, getNewProducts, getNewArrivals, getLatestReviews, getLatestGalleryItems } from "@/lib/storefront";
import { getPublicStoreSettings } from "@/lib/storeSettings";
import ProductSlider from "@/components/shop/ProductSlider";
import CategorySlider from "@/components/shop/CategorySlider";
import WeeklyMvp from "@/components/shop/WeeklyMvp";
import ReviewsSection from "@/components/shop/ReviewsSection";
import GallerySection from "@/components/shop/GallerySection";
import Hero from "@/components/shop/Hero";
import { SITE_NAME } from "@/lib/seo";

// Intended as ISR (regenerate in the background at most once every 60s)
// to cut response time. Currently NOT effective: (shop)/layout.tsx reads
// cookies() via getCurrentCustomer() for the header's login state, and any
// dynamic API used in a route's tree forces the whole route to render on
// every request, silently overriding this. Will start working once that
// customer-session check moves to a client-side fetch instead.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicStoreSettings();
  const description = `Shop ${settings.storeName || SITE_NAME} — premium apparel and custom DTF-printed t-shirts with island-wide delivery across Sri Lanka.`;
  return {
    title: { absolute: `${settings.storeName || SITE_NAME} — Premium Apparel, Island-Wide Delivery` },
    description,
    alternates: { canonical: "/" },
    openGraph: { title: settings.storeName || SITE_NAME, description, url: "/", images: settings.logoDark || settings.logo ? [{ url: settings.logoDark || settings.logo }] : undefined },
  };
}

export default async function HomePage() {
  const [settings, categories, featured, deals, latest, newArrivals, reviews, galleryItems] = await Promise.all([
    getPublicStoreSettings(),
    getActiveCategories(),
    getFeaturedProducts(8),
    getDeals(8),
    getNewProducts(8),
    getNewArrivals(12),
    getLatestReviews(12),
    getLatestGalleryItems(6),
  ]);

  return (
    <div>
      <Hero slides={settings.heroSlides} storeName={settings.storeName} />

      {/* New Collection slider — admin-curated via the "New" flag in Storefront Catalog */}
      <ProductSlider products={newArrivals} title="FRESH SWAG. RELEASED." href="/shop?sort=new" />

      {/* Categories — large black image tiles */}
      <CategorySlider categories={categories} title="Shop by Category" />

      {/* Weekly MVP — spotlight on the newest product, PDP-style */}
      {latest.length > 0 && <WeeklyMvp product={latest[0]} />}

      {deals.length > 0 && <ProductSlider title="🔥 Deals" href="/deals" products={deals} />}
      {featured.length > 0 && <ProductSlider title="Best of the Best" href="/shop" products={featured} />}
      {latest.length > 0 && <ProductSlider title="Just In" href="/shop?sort=new" products={latest} />}

      {/* Custom orders gallery — latest published items, featured first */}
      {galleryItems.length > 0 && (
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-10">
          <GallerySection items={galleryItems} title="Custom orders, made real" />
        </div>
      )}

      {/* What customers say — latest published reviews (rounded black panel, like the PDP) */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-10">
        <ReviewsSection reviews={reviews} title="What our customers say" variant="carousel" showProduct bare logo={settings.logoLight || settings.logo} />
      </div>

      {featured.length === 0 && deals.length === 0 && latest.length === 0 && (
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-20 text-center text-gray-500">
          <p className="text-lg">No products published yet.</p>
          <p className="text-sm mt-1">Mark products as active in the admin Storefront Catalog.</p>
        </div>
      )}
    </div>
  );
}
