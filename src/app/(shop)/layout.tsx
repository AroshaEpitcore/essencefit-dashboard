import { CartProvider } from "@/components/shop/CartContext";
import { WishlistProvider } from "@/components/shop/WishlistContext";
import { QuickViewProvider } from "@/components/shop/QuickView";
import StoreHeader from "@/components/shop/StoreHeader";
import HeaderOffset from "@/components/shop/HeaderOffset";
import StoreFooter from "@/components/shop/StoreFooter";
import { getActiveCategories } from "@/lib/storefront";
import { getPublicStoreSettings } from "@/lib/storeSettings";
import { displayFont, headingFont } from "@/lib/fonts";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([
    getPublicStoreSettings(),
    getActiveCategories(),
  ]);

  return (
    <CartProvider>
      <WishlistProvider>
        <QuickViewProvider>
          <div className={`${displayFont.className} ${headingFont.variable} store-headings min-h-screen flex flex-col bg-white text-gray-900`}>
            <StoreHeader settings={settings} categories={categories} />
            <main className="flex-1">
              <HeaderOffset hasPromo={!!settings.announcement} />
              {children}
            </main>
            <StoreFooter settings={settings} categories={categories} />
          </div>
        </QuickViewProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
