"use client";

import Link from "next/link";
import { Heart, X, ShoppingCart } from "lucide-react";
import { useWishlist } from "@/components/shop/WishlistContext";
import { useQuickView } from "@/components/shop/QuickView";
import { money, discountPct } from "@/components/shop/format";

export default function WishlistPage() {
  const { items, remove, ready } = useWishlist();
  const { open: openQuickView } = useQuickView();

  if (ready && items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Heart className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your wishlist is empty</h1>
        <p className="text-gray-500 mb-6">Tap the heart on any product to save it here.</p>
        <Link href="/shop" className="inline-block bg-primary text-white px-8 py-3 rounded-full font-semibold hover:bg-primary/90">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My wishlist</h1>
      <p className="text-sm text-gray-500 mb-6">{items.length} item{items.length !== 1 ? "s" : ""}</p>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
        {items.map((it) => {
          const pct = discountPct(it.price, it.compareAt);
          return (
            <div key={it.productId} className="border border-gray-200 bg-white flex flex-col">
              <div className="relative aspect-[4/5] bg-gray-100 overflow-hidden">
                <Link href={`/product/${it.slug}`} className="block w-full h-full">
                  {it.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">No image</div>
                  )}
                </Link>
                <button
                  type="button"
                  onClick={() => remove(it.productId)}
                  aria-label="Remove from wishlist"
                  className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-white/85 flex items-center justify-center text-gray-600 hover:text-red-500 shadow-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 flex flex-col flex-1">
                <Link href={`/product/${it.slug}`}>
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-1">{it.name}</h3>
                </Link>
                <div className="mt-1 flex items-baseline gap-2">
                  {pct > 0 && <span className="text-sm text-gray-400 line-through">{money(it.compareAt)}</span>}
                  <span className="text-sm font-bold text-gray-900">{money(it.price)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => openQuickView(it.productId)}
                  className="mt-3 w-full border border-gray-900 text-gray-900 text-sm font-semibold py-2 flex items-center justify-center gap-2 hover:bg-gray-900 hover:text-white transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" /> Add to cart
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
