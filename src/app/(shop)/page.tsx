import type { Metadata } from "next";
import { getFeaturedProducts, getDeals, getActiveCategories, getNewProducts, getNewArrivals, getLatestReviews, getLatestGalleryItems, getLatestFeedback, getProductVariants, getProductImagesByColor, getProductRatingSummary } from "@/lib/storefront";
import { getPublicStoreSettings } from "@/lib/storeSettings";
import ProductSlider from "@/components/shop/ProductSlider";
import CategorySlider from "@/components/shop/CategorySlider";
import WeeklyMvp from "@/components/shop/WeeklyMvp";
import ReviewsSection from "@/components/shop/ReviewsSection";
import GallerySection from "@/components/shop/GallerySection";
import DealsBanner from "@/components/shop/DealsBanner";
import FeedbackSection from "@/components/shop/FeedbackSection";
import Hero from "@/components/shop/Hero";
import { SITE_NAME } from "@/lib/seo";

// ISR: regenerate in the background at most once every 60s. This works only
// because NOTHING in this route's tree reads cookies() — the header's login
// state is fetched client-side by AccountMenu. Adding a cookies()/headers()
// call anywhere in (shop)/layout.tsx or this page silently disables it again.
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
  const [settings, categories, featured, deals, latest, newArrivals, reviews, galleryItems, feedback] = await Promise.all([
    getPublicStoreSettings(),
    getActiveCategories(),
    getFeaturedProducts(8),
    getDeals(8),
    getNewProducts(8),
    getNewArrivals(12),
    getLatestReviews(),
    getLatestGalleryItems(100),
    getLatestFeedback(100),
  ]);

  // Weekly MVP = newest product, with the PDP buy-box data (variants/images/rating).
  const mvp = latest[0] ?? null;
  const [mvpVariants, mvpImages, mvpRating] = mvp
    ? await Promise.all([
        getProductVariants(mvp.Id),
        getProductImagesByColor(mvp.Id),
        getProductRatingSummary(mvp.Id),
      ])
    : [[], { shared: [], byColor: {} }, { avg: 0, count: 0 }];

  return (
    <div>
      <Hero slides={settings.heroSlides} storeName={settings.storeName} />

      {/* New Collection slider — admin-curated via the "New" flag in Storefront Catalog */}
      <ProductSlider products={newArrivals} title="FRESH SWAG. RELEASED." href="/shop?sort=new" />

      {/* Categories — large black image tiles */}
      <CategorySlider categories={categories} title="Shop by Category" />

      {/* Weekly MVP — spotlight on the newest product with the PDP buy box */}
      {mvp && <WeeklyMvp product={mvp} variants={mvpVariants} images={mvpImages} rating={mvpRating} />}

      {/* Deals — full-width black band (copy left, swipeable deal cards right) */}
      <DealsBanner deals={deals} />
      {featured.length > 0 && <ProductSlider title="Best of the Best" href="/shop" products={featured} />}

      {/* Custom orders gallery — right under Best of the Best */}
      {galleryItems.length > 0 && (
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-14">
          <GallerySection items={galleryItems} title="Custom orders, made real" />
        </div>
      )}

      {latest.length > 0 && <ProductSlider title="Just In" href="/shop?sort=new" products={latest} />}

      {/* What customers say — latest published reviews (rounded black panel, like the PDP) */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-14">
        <ReviewsSection reviews={reviews} title="What our customers say" variant="carousel" showProduct bare logo={settings.logoLight || settings.logo} />
      </div>

      {/* Customer feedback wall — screenshot marquee (rounded black panel) */}
      {feedback.length > 0 && (
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-14">
          <FeedbackSection items={feedback} title="Straight from our customers" />
        </div>
      )}

      {featured.length === 0 && deals.length === 0 && latest.length === 0 && (
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-20 text-center text-gray-500">
          <p className="text-lg">No products published yet.</p>
          <p className="text-sm mt-1">Mark products as active in the admin Storefront Catalog.</p>
        </div>
      )}
    </div>
  );
}
