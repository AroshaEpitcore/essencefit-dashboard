"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ShoppingCart, Search, Menu, X, Heart } from "lucide-react";
import { useCart } from "./CartContext";
import { useWishlist } from "./WishlistContext";
import AccountMenu, { type NavCustomer } from "./AccountMenu";
import type { StoreCategory } from "@/lib/storefront";
import type { StoreSettings } from "@/lib/storeSettings";

export default function StoreHeader({
  settings,
  categories,
  customer,
}: {
  settings: StoreSettings;
  categories: StoreCategory[];
  customer: NavCustomer;
}) {
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";

  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isHome) {
      setScrolled(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  const solid = scrolled || menuOpen;
  const onDark = !solid;

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/shop?q=${encodeURIComponent(q.trim())}`);
    setMenuOpen(false);
  }

  const logoSrc = solid ? settings.logoDark || settings.logo : settings.logoLight || "";
  const iconCls = onDark ? "text-white hover:text-white/70" : "text-gray-800 hover:text-primary";
  const linkCls = onDark ? "text-white/90 hover:text-white" : "text-gray-700 hover:text-primary";

  return (
    <header className="fixed top-0 inset-x-0 z-50">
      {/* Top promo banner */}
      {settings.announcement && (
        <div className="h-9 bg-gray-900 text-white flex items-center justify-center px-4">
          <span className="line-clamp-1 text-center text-[11px] sm:text-xs tracking-wide">{settings.announcement}</span>
        </div>
      )}

      {/* Nav bar (transparent over hero, solid on scroll) */}
      <div className={`transition-colors duration-300 ${solid ? "bg-white shadow-sm" : "bg-transparent"}`}>
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 flex items-center gap-4 h-16 md:h-24">
          <button className={`md:hidden ${iconCls}`} onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <Link href="/" className="flex items-center gap-2 shrink-0" onClick={() => setMenuOpen(false)}>
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt={settings.storeName} className="h-7 md:h-12 object-contain" />
            ) : (
              <span className={`text-xl font-extrabold ${onDark ? "text-white" : "text-gray-900"}`}>{settings.storeName}</span>
            )}
          </Link>

          <nav className="hidden md:flex items-center gap-6 ml-6 text-sm font-medium">
            <Link href="/shop" className={linkCls}>All</Link>
            {categories.slice(0, 5).map((c) => (
              <Link key={c.Id} href={`/category/${c.Slug}`} className={`${linkCls} whitespace-nowrap`}>{c.Name}</Link>
            ))}
            <Link href="/deals" className={onDark ? "text-white font-semibold" : "text-primary font-semibold"}>Deals</Link>
            <Link href="/customize" className={`${linkCls} whitespace-nowrap`}>Customize</Link>
          </nav>

          <form onSubmit={submitSearch} className="hidden lg:flex flex-1 max-w-xs ml-auto relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products..."
              className={`w-full rounded-full pl-4 pr-10 py-2 text-sm focus:outline-none transition-colors ${
                onDark
                  ? "bg-white/15 text-white placeholder-white/70 border border-white/30 focus:bg-white/25"
                  : "bg-gray-100 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary/30"
              }`}
            />
            <button type="submit" className={`absolute right-3 top-1/2 -translate-y-1/2 ${onDark ? "text-white/80" : "text-gray-400"}`}>
              <Search className="w-4 h-4" />
            </button>
          </form>

          <div className="flex items-center gap-4 ml-auto lg:ml-3">
            <AccountMenu customer={customer} iconCls={iconCls} />
            <Link href="/wishlist" className={`relative ${iconCls}`} aria-label="Wishlist">
              <Heart className="w-6 h-6" />
              {wishCount > 0 && <span className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{wishCount}</span>}
            </Link>
            <Link href="/cart" className={`relative ${iconCls}`} aria-label="Cart">
              <ShoppingCart className="w-6 h-6" />
              {count > 0 && <span className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{count}</span>}
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 px-4 py-3">
          <form onSubmit={submitSearch} className="relative mb-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products..."
              className="w-full bg-gray-100 rounded-full pl-4 pr-10 py-2 text-sm text-gray-800 focus:outline-none"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><Search className="w-4 h-4" /></button>
          </form>
          <nav className="space-y-1">
            <Link href="/shop" onClick={() => setMenuOpen(false)} className="block py-2 text-gray-700">All products</Link>
            {categories.map((c) => (
              <Link key={c.Id} href={`/category/${c.Slug}`} onClick={() => setMenuOpen(false)} className="block py-2 text-gray-700">{c.Name}</Link>
            ))}
            <Link href="/deals" onClick={() => setMenuOpen(false)} className="block py-2 text-primary font-semibold">Deals</Link>
            <Link href="/customize" onClick={() => setMenuOpen(false)} className="block py-2 text-gray-700">Customize &amp; DTF Print</Link>
            <Link href="/wishlist" onClick={() => setMenuOpen(false)} className="block py-2 text-gray-700">Wishlist</Link>
            <Link href="/account" onClick={() => setMenuOpen(false)} className="block py-2 text-gray-700">My account</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
