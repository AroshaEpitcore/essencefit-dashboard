"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShoppingCart, Search, Menu, X, User, Heart } from "lucide-react";
import { useCart } from "./CartContext";
import { useWishlist } from "./WishlistContext";
import type { StoreCategory } from "@/lib/storefront";
import type { StoreSettings } from "@/lib/storeSettings";

export default function StoreHeader({
  settings,
  categories,
}: {
  settings: StoreSettings;
  categories: StoreCategory[];
}) {
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/shop?q=${encodeURIComponent(q.trim())}`);
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      {settings.announcement && (
        <div className="bg-primary text-white text-center text-xs sm:text-sm py-1.5 px-4">
          {settings.announcement}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 flex items-center gap-4 h-16">
        <button className="md:hidden text-gray-700" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        <Link href="/" className="flex items-center gap-2 shrink-0">
          {settings.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo} alt={settings.storeName} className="h-8 object-contain" />
          ) : (
            <span className="text-xl font-extrabold text-gray-900">{settings.storeName}</span>
          )}
        </Link>

        {/* Desktop category nav */}
        <nav className="hidden md:flex items-center gap-5 ml-4 text-sm font-medium text-gray-600">
          <Link href="/shop" className="hover:text-primary">All</Link>
          {categories.slice(0, 5).map((c) => (
            <Link key={c.Id} href={`/category/${c.Slug}`} className="hover:text-primary whitespace-nowrap">
              {c.Name}
            </Link>
          ))}
          <Link href="/deals" className="text-primary font-semibold">Deals</Link>
        </nav>

        {/* Search */}
        <form onSubmit={submitSearch} className="hidden sm:flex flex-1 max-w-md ml-auto relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products..."
            className="w-full bg-gray-100 rounded-full pl-4 pr-10 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Search className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center gap-3 ml-auto sm:ml-0">
          <Link href="/account" className="text-gray-700 hover:text-primary" aria-label="Account">
            <User className="w-6 h-6" />
          </Link>
          <Link href="/wishlist" className="relative text-gray-700 hover:text-primary" aria-label="Wishlist">
            <Heart className="w-6 h-6" />
            {wishCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {wishCount}
              </span>
            )}
          </Link>
          <Link href="/cart" className="relative text-gray-700 hover:text-primary" aria-label="Cart">
            <ShoppingCart className="w-6 h-6" />
            {count > 0 && (
              <span className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Mobile search */}
      <form onSubmit={submitSearch} className="sm:hidden px-4 pb-3 relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products..."
          className="w-full bg-gray-100 rounded-full pl-4 pr-10 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button type="submit" className="absolute right-7 top-1/2 -translate-y-1/2 text-gray-400">
          <Search className="w-4 h-4" />
        </button>
      </form>

      {/* Mobile drawer */}
      {menuOpen && (
        <nav className="md:hidden border-t border-gray-200 bg-white px-4 py-3 space-y-1">
          <Link href="/shop" onClick={() => setMenuOpen(false)} className="block py-2 text-gray-700">All products</Link>
          {categories.map((c) => (
            <Link key={c.Id} href={`/category/${c.Slug}`} onClick={() => setMenuOpen(false)} className="block py-2 text-gray-700">
              {c.Name}
            </Link>
          ))}
          <Link href="/deals" onClick={() => setMenuOpen(false)} className="block py-2 text-primary font-semibold">Deals</Link>
          <Link href="/account" onClick={() => setMenuOpen(false)} className="block py-2 text-gray-700">My account</Link>
        </nav>
      )}
    </header>
  );
}
