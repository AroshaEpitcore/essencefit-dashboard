import { CartProvider } from "@/components/shop/CartContext";
import { WishlistProvider } from "@/components/shop/WishlistContext";
import { QuickViewProvider } from "@/components/shop/QuickView";
import StoreHeader from "@/components/shop/StoreHeader";
import StoreFooter from "@/components/shop/StoreFooter";
import { getActiveCategories } from "@/lib/storefront";
import { getPublicStoreSettings } from "@/lib/storeSettings";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([
    getPublicStoreSettings(),
    getActiveCategories(),
  ]);

  return (
    <CartProvider>
      <WishlistProvider>
        <QuickViewProvider>
          <div className="min-h-screen flex flex-col bg-white text-gray-900">
            <StoreHeader settings={settings} categories={categories} />
            <main className="flex-1">{children}</main>
            <StoreFooter settings={settings} categories={categories} />
          </div>
        </QuickViewProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
