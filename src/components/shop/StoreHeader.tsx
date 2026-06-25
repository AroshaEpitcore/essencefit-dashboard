"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, Search, Menu, X, Heart, ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "./CartContext";
import { useWishlist } from "./WishlistContext";
import { useQuickView } from "./QuickView";
import AccountMenu, { type NavCustomer } from "./AccountMenu";
import { money } from "./format";
import type { StoreCategory, StoreProduct, MegaProduct } from "@/lib/storefront";
import type { StoreSettings } from "@/lib/storeSettings";

export default function StoreHeader({
  settings,
  categories,
  customer,
  featured,
  categoryProducts,
}: {
  settings: StoreSettings;
  categories: StoreCategory[];
  customer: NavCustomer;
  featured: StoreProduct[];
  categoryProducts: MegaProduct[];
}) {
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const { open: openQuickView } = useQuickView();
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";

  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<null | "shop" | "customize">(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
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

  // Group the category-preview products by category for the Shop mega menu.
  const byCat = useMemo(() => {
    const m: Record<string, MegaProduct[]> = {};
    for (const p of categoryProducts) (m[p.CategoryId] ||= []).push(p);
    return m;
  }, [categoryProducts]);

  // "All products" view = featured products, or all category previews mixed
  // when nothing is flagged featured (so it always shows something).
  const allItems: MegaProduct[] = featured.length
    ? featured.map((p) => ({ Id: p.Id, Name: p.Name, Slug: p.Slug, ImageUrl: p.ImageUrl, SellingPrice: p.SellingPrice, CompareAtPrice: p.CompareAtPrice, CategoryId: "" }))
    : categoryProducts;
  const effectiveCat = activeCat ?? "__all";
  const rightItems = effectiveCat === "__all" ? allItems : byCat[effectiveCat] || [];
  const effHeading = effectiveCat === "__all" ? "Featured" : categories.find((c) => c.Id === effectiveCat)?.Name ?? "";

  // Preload category + featured imagery when the Shop menu opens so the
  // hover-to-swap is instant and smooth (no network flash).
  useEffect(() => {
    if (openMenu !== "shop" || typeof window === "undefined") return;
    for (const u of [...categoryProducts.map((p) => p.ImageUrl), ...featured.map((p) => p.ImageUrl)]) {
      if (u) {
        const img = new window.Image();
        img.src = u;
      }
    }
  }, [openMenu, categoryProducts, featured]);

  const solid = scrolled || menuOpen || openMenu !== null;
  const onDark = !solid;

  const closeMenus = () => {
    setOpenMenu(null);
    setMenuOpen(false);
  };

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/shop?q=${encodeURIComponent(q.trim())}`);
    closeMenus();
  }

  const logoSrc = solid ? settings.logoDark || settings.logo : settings.logoLight || "";
  const logoMark = settings.logoDark || settings.logo || "";
  const iconCls = onDark ? "text-white hover:text-white/70" : "text-gray-800 hover:text-primary";
  const linkCls = onDark ? "text-white/90 hover:text-white" : "text-gray-700 hover:text-primary";

  // Imagery for the mega-menu right panels: featured products, falling back to
  // category tiles when no products are flagged featured.
  const promoItems = featured.length
    ? featured.map((p) => ({ href: `/product/${p.Slug}`, img: p.ImageUrl, name: p.Name, price: money(p.SellingPrice) }))
    : categories.filter((c) => c.ImageUrl).map((c) => ({ href: `/category/${c.Slug}`, img: c.ImageUrl, name: c.Name, price: "" }));

  const navBtn = `${linkCls} inline-flex items-center gap-1 cursor-pointer`;

  return (
    <>
      {/* Dim the page behind the mega menu */}
      {openMenu && (
        <div
          className="hidden md:block fixed inset-0 z-40 bg-black/30"
          onMouseEnter={() => setOpenMenu(null)}
          onClick={() => setOpenMenu(null)}
          aria-hidden
        />
      )}
      <header className="fixed top-0 inset-x-0 z-50">
      {/* Top promo banner */}
      {settings.announcement && (
        <div className="h-9 bg-gray-900 text-white flex items-center justify-center px-4">
          <span className="line-clamp-1 text-center text-[11px] sm:text-xs tracking-wide">{settings.announcement}</span>
        </div>
      )}

      {/* Nav bar (transparent over hero, solid on scroll / when a menu is open) */}
      <div
        className={`relative transition-colors duration-300 ${solid ? "bg-white shadow-sm" : "bg-transparent"}`}
        onMouseLeave={() => setOpenMenu(null)}
      >
        <div className="max-w-[1920px] mx-auto px-4 sm:px-8 relative flex items-center h-16 md:h-24">
          {/* Left: mobile menu toggle + desktop mega-nav */}
          <div className="flex items-center gap-4 md:gap-6">
            <button className={`md:hidden ${iconCls}`} onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
              <button
                type="button"
                onMouseEnter={() => setOpenMenu("shop")}
                onClick={() => { router.push("/shop"); closeMenus(); }}
                className={navBtn}
              >
                Shop <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openMenu === "shop" ? "rotate-180" : ""}`} />
              </button>
              <button
                type="button"
                onMouseEnter={() => setOpenMenu("customize")}
                onClick={() => { router.push("/customize"); closeMenus(); }}
                className={navBtn}
              >
                Customize <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openMenu === "customize" ? "rotate-180" : ""}`} />
              </button>
              <Link
                href="/deals"
                onMouseEnter={() => setOpenMenu(null)}
                className={onDark ? "text-white font-semibold" : "text-primary font-semibold"}
              >
                Deals
              </Link>
            </nav>
          </div>

          {/* Center: logo */}
          <Link
            href="/"
            onMouseEnter={() => setOpenMenu(null)}
            className="absolute left-1/2 -translate-x-1/2 flex items-center"
            onClick={closeMenus}
          >
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt={settings.storeName} className="h-7 md:h-12 object-contain" />
            ) : (
              <span className={`text-xl font-extrabold ${onDark ? "text-white" : "text-gray-900"}`}>{settings.storeName}</span>
            )}
          </Link>

          {/* Right: search + icons */}
          <div className="flex items-center gap-4 ml-auto" onMouseEnter={() => setOpenMenu(null)}>
            <form onSubmit={submitSearch} className="hidden lg:flex w-44 xl:w-56 relative">
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

        {/* Mega menu panel (desktop) */}
        {openMenu && (
          <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-full w-3/4 bg-white shadow-xl border border-t-0 border-gray-100 rounded-b-xl overflow-hidden">
            {openMenu === "shop" && (
              <div className="grid grid-cols-[240px_1fr]">
                {/* Col 1: category rail (gray) */}
                <div className="bg-gray-50 px-6 py-7 flex flex-col">
                  <ul className="-mx-2">
                    <li>
                      <Link
                        href="/shop"
                        onMouseEnter={() => setActiveCat("__all")}
                        onClick={closeMenus}
                        className={`w-full flex items-center justify-between rounded-md px-3 py-2.5 text-[15px] transition-colors ${effectiveCat === "__all" ? "text-gray-900 font-bold" : "text-gray-500 hover:text-gray-900"}`}
                      >
                        Featured
                        <ChevronRight className={`w-4 h-4 transition-opacity ${effectiveCat === "__all" ? "opacity-100" : "opacity-0"}`} />
                      </Link>
                    </li>
                    {categories.map((c) => {
                      const active = effectiveCat === c.Id;
                      return (
                        <li key={c.Id}>
                          <Link
                            href={`/category/${c.Slug}`}
                            onMouseEnter={() => setActiveCat(c.Id)}
                            onClick={closeMenus}
                            className={`group/cat w-full flex items-center justify-between rounded-md px-3 py-2.5 text-[15px] transition-colors ${active ? "text-gray-900 font-bold" : "text-gray-500 hover:text-gray-900"}`}
                          >
                            {c.Name}
                            <ChevronRight className={`w-4 h-4 transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover/cat:opacity-50"}`} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-auto pt-6">
                    <div className="border-t border-gray-200 pt-5 space-y-2.5">
                      <Link href="/account" onClick={closeMenus} className="block px-3 text-[13px] text-gray-500 hover:text-gray-900">My account</Link>
                      <Link href="/wishlist" onClick={closeMenus} className="block px-3 text-[13px] text-gray-500 hover:text-gray-900">Wishlist</Link>
                      <Link href="/deals" onClick={closeMenus} className="block px-3 text-[13px] text-gray-500 hover:text-gray-900">Deals</Link>
                    </div>
                    {logoMark && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoMark} alt="" aria-hidden className="mt-6 ml-3 h-7 w-auto opacity-[0.08] grayscale" />
                    )}
                  </div>
                </div>

                {/* Col 2 + 3: collection links + big imagery (crossfade together) */}
                <div className="px-10 py-8 min-h-[340px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={effectiveCat}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="flex gap-10"
                    >
                      {/* Heading + product links */}
                      <div className="w-[190px] shrink-0">
                        <h3 className="text-2xl font-extrabold uppercase tracking-tight text-gray-900">{effHeading}</h3>
                        <p className="mt-6 mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Products</p>
                        {rightItems.length ? (
                          <ul className="space-y-2">
                            {rightItems.slice(0, 6).map((p) => (
                              <li key={p.Id}>
                                <Link href={`/product/${p.Slug}`} onClick={closeMenus} className="text-sm text-gray-600 hover:text-gray-900">{p.Name}</Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-400">No products yet.</p>
                        )}
                        <Link
                          href={effectiveCat === "__all" ? "/shop" : `/category/${categories.find((c) => c.Id === effectiveCat)?.Slug ?? ""}`}
                          onClick={closeMenus}
                          className="mt-6 inline-block text-xs font-semibold text-primary hover:underline"
                        >
                          View all →
                        </Link>
                      </div>

                      {/* Big imagery */}
                      <div className="flex gap-6">
                        {rightItems.slice(0, 2).map((p) => (
                          <div key={p.Id} className="group w-[210px] shrink-0">
                            <div className="relative aspect-[4/5] bg-gray-100 overflow-hidden">
                              <Link href={`/product/${p.Slug}`} onClick={closeMenus} className="block w-full h-full">
                                {p.ImageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.ImageUrl} alt={p.Name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">No image</div>
                                )}
                              </Link>
                              <button
                                type="button"
                                onClick={() => { openQuickView(p.Id); closeMenus(); }}
                                className="absolute inset-x-3 bottom-3 z-10 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200 bg-gray-900 text-white text-xs font-semibold py-2.5 flex items-center justify-center gap-1.5 hover:bg-black"
                              >
                                <ShoppingCart className="w-4 h-4" /> Add to cart
                              </button>
                            </div>
                            <p className="mt-3 text-sm font-bold text-gray-900">{p.Name}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            )}

            {openMenu === "customize" && (
              <div className="max-w-[1920px] mx-auto px-6 py-8">
                <div className="grid grid-cols-[1fr_1.5fr] gap-12">
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Make it yours</h3>
                    <ul className="space-y-2.5 text-sm">
                      <li><Link href="/customize" onClick={closeMenus} className="text-gray-700 hover:text-primary">Start customizing</Link></li>
                      <li><Link href="/customize" onClick={closeMenus} className="text-gray-700 hover:text-primary">DTF printing</Link></li>
                      <li><Link href="/shop" onClick={closeMenus} className="text-gray-700 hover:text-primary">Printable garments</Link></li>
                    </ul>
                    <p className="mt-4 text-sm text-gray-500 leading-relaxed max-w-[15rem]">
                      Add your own design or text — printed on demand and delivered to your door.
                    </p>
                    <Link href="/customize" onClick={closeMenus} className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">Start now →</Link>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {promoItems.slice(0, 2).map((it, i) => (
                      <Link key={i} href="/customize" onClick={closeMenus} className="group block">
                        <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                          {it.img && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="px-4 py-4">
            <form onSubmit={submitSearch} className="relative mb-5">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products..."
                className="w-full bg-gray-100 rounded-full pl-4 pr-10 py-2.5 text-sm text-gray-800 focus:outline-none"
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><Search className="w-4 h-4" /></button>
            </form>

            <p className="px-1 mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Shop by category</p>
            <nav className="mb-5">
              <Link href="/shop" onClick={closeMenus} className="flex items-center justify-between py-3 text-[15px] font-semibold text-gray-900 border-b border-gray-100">
                Featured <ChevronRight className="w-4 h-4 text-gray-400" />
              </Link>
              {categories.map((c) => (
                <Link key={c.Id} href={`/category/${c.Slug}`} onClick={closeMenus} className="flex items-center justify-between py-3 text-[15px] text-gray-600 border-b border-gray-100">
                  {c.Name} <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
              ))}
              <Link href="/customize" onClick={closeMenus} className="flex items-center justify-between py-3 text-[15px] text-gray-600 border-b border-gray-100">
                Customize &amp; DTF Print <ChevronRight className="w-4 h-4 text-gray-400" />
              </Link>
              <Link href="/deals" onClick={closeMenus} className="flex items-center justify-between py-3 text-[15px] font-bold text-primary">
                Deals <ChevronRight className="w-4 h-4" />
              </Link>
            </nav>

            <p className="px-1 mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Account</p>
            <nav>
              <Link href="/account" onClick={closeMenus} className="block py-2.5 text-[15px] text-gray-600">My account</Link>
              <Link href="/wishlist" onClick={closeMenus} className="block py-2.5 text-[15px] text-gray-600">Wishlist</Link>
            </nav>
          </div>
        </div>
      )}
      </header>
    </>
  );
}
