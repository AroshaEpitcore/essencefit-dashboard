import { CartProvider } from "@/components/shop/CartContext";
import { WishlistProvider } from "@/components/shop/WishlistContext";
import { QuickViewProvider } from "@/components/shop/QuickView";
import StoreHeader from "@/components/shop/StoreHeader";
import HeaderOffset from "@/components/shop/HeaderOffset";
import StoreFooter from "@/components/shop/StoreFooter";
import CookieConsent from "@/components/shop/CookieConsent";
import { getActiveCategories, getFeaturedProducts, getCategoryPreviews } from "@/lib/storefront";
import { getPublicStoreSettings } from "@/lib/storeSettings";
import { getCurrentCustomer } from "@/lib/customerAuth";
import { displayFont, headingFont } from "@/lib/fonts";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories, customer, featured, categoryProducts] = await Promise.all([
    getPublicStoreSettings(),
    getActiveCategories(),
    getCurrentCustomer(),
    getFeaturedProducts(6),
    getCategoryPreviews(4),
  ]);

  return (
    <CartProvider>
      <WishlistProvider>
        <QuickViewProvider>
          <div
            className={`${displayFont.className} ${headingFont.variable} store-headings min-h-screen flex flex-col bg-white text-gray-900`}
            style={{ "--header-h": settings.announcement ? "116px" : "80px" } as React.CSSProperties}
          >
            <StoreHeader settings={settings} categories={categories} customer={customer} featured={featured} categoryProducts={categoryProducts} />
            <main className="flex-1">
              <HeaderOffset hasPromo={!!settings.announcement} />
              {children}
            </main>
            <StoreFooter settings={settings} categories={categories} />
            <CookieConsent />
          </div>
        </QuickViewProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
