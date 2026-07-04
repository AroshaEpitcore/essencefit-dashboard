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
import Marquee from "./Marquee";
import { money } from "./format";
import { quickSearch } from "@/app/(shop)/searchAction";
import type { StoreCategory, StoreProduct, MegaProduct, LiteProduct } from "@/lib/storefront";
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

  // Promo messages: one per line in the admin banner field. The free-delivery
  // line is generated from the actual threshold (so it always matches checkout);
  // any manual "free delivery" line is dropped to avoid contradicting it.
  const customPromo = settings.announcement
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((t) => !/free\s*delivery/i.test(t));
  const promoItems =
    settings.freeDeliveryOver > 0
      ? [`Free delivery on orders over ${money(settings.freeDeliveryOver)}`, ...customPromo]
      : customPromo;

  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<null | "shop" | "customize">(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState<LiteProduct[]>([]);
  const [searching, setSearching] = useState(false);
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
    setSearchOpen(false);
  };

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/shop?q=${encodeURIComponent(q.trim())}`);
    closeMenus();
  }

  // Type-ahead: debounce the query and fetch matching products for the drawer.
  useEffect(() => {
    if (!searchOpen) return;
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        setResults(await quickSearch(term));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, searchOpen]);

  const logoMark = settings.logoDark || settings.logo || "";
  const lightLogo = settings.logoLight || "";
  const darkLogo = settings.logoDark || settings.logo || "";
  const hasBothLogos = !!(lightLogo && darkLogo);
  const iconCls = `transition-colors duration-300 ${onDark ? "text-white hover:text-white/70" : "text-gray-800 hover:text-primary"}`;
  const linkCls = `transition-colors duration-300 ${onDark ? "text-white/90 hover:text-white" : "text-gray-700 hover:text-primary"}`;

  const navBtn = `${linkCls} inline-flex items-center gap-1 cursor-pointer`;

  return (
    <>
      {/* Dim the page behind the mega menu */}
      <AnimatePresence>
        {openMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="hidden md:block fixed inset-0 z-40 bg-black/30"
            onMouseEnter={() => setOpenMenu(null)}
            onClick={() => setOpenMenu(null)}
            aria-hidden
          />
        )}
      </AnimatePresence>
      <header className="fixed top-0 inset-x-0 z-50">
      {/* Top promo banner — scrolling marquee (one message per line in admin) */}
      {promoItems.length > 0 && (
        <div className="h-9 bg-primary text-white flex items-center">
          <Marquee items={promoItems} />
        </div>
      )}

      {/* Nav bar (transparent over hero, solid on scroll / when a menu is open) */}
      <div
        className={`relative transition-colors duration-300 ${solid ? "bg-white shadow-sm" : "bg-transparent"}`}
        onMouseLeave={() => setOpenMenu(null)}
      >
        <div className="max-w-[1920px] mx-auto px-4 sm:px-8 relative flex items-center h-16 md:h-20">
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
                className={`transition-colors duration-300 ${onDark ? "text-white font-semibold" : "text-primary font-semibold"}`}
              >
                Deals
              </Link>
              <Link href="/gallery" onMouseEnter={() => setOpenMenu(null)} className={linkCls}>
                Gallery
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
            {hasBothLogos ? (
              <span className="relative inline-block h-7 md:h-12">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lightLogo} alt={settings.storeName} className={`h-full w-auto object-contain transition-opacity duration-300 ${solid ? "opacity-0" : "opacity-100"}`} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={darkLogo} alt="" aria-hidden className={`absolute left-0 top-0 h-full w-auto object-contain transition-opacity duration-300 ${solid ? "opacity-100" : "opacity-0"}`} />
              </span>
            ) : lightLogo || darkLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={solid ? darkLogo || lightLogo : lightLogo || darkLogo} alt={settings.storeName} className="h-7 md:h-12 object-contain" />
            ) : (
              <span className={`text-xl font-extrabold transition-colors duration-300 ${onDark ? "text-white" : "text-gray-900"}`}>{settings.storeName}</span>
            )}
          </Link>

          {/* Right: search + icons */}
          <div className="flex items-center gap-4 ml-auto" onMouseEnter={() => setOpenMenu(null)}>
            <button
              type="button"
              onClick={() => { setSearchOpen(true); setOpenMenu(null); }}
              className={iconCls}
              aria-label="Search"
            >
              <Search className="w-6 h-6" />
            </button>

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
        <AnimatePresence>
        {openMenu && (
          <motion.div
            key="mega-panel"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="hidden md:block absolute left-0 right-0 top-full bg-white shadow-xl border-t border-gray-100 overflow-hidden"
          >
            {openMenu === "shop" && (
              <div className="max-w-[1920px] mx-auto grid grid-cols-[260px_1fr]">
                {/* Col 1: category rail (gray) */}
                <div className="bg-gray-50 px-6 py-7 flex flex-col">
                  <ul className="-mx-2">
                    <li>
                      <Link
                        href="/shop"
                        onMouseEnter={() => setActiveCat("__all")}
                        onClick={closeMenus}
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-[15px] transition-colors ${effectiveCat === "__all" ? "text-gray-900 font-bold" : "text-gray-500 hover:text-gray-900"}`}
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
                            className={`group/cat w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-[15px] transition-colors ${active ? "text-gray-900 font-bold" : "text-gray-500 hover:text-gray-900"}`}
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
                      <div className="flex flex-1 flex-wrap gap-6">
                        {rightItems.slice(0, 4).map((p) => (
                          <div key={p.Id} className="group w-[200px] shrink-0">
                            <div className="relative aspect-[4/5] rounded-lg bg-gray-100 overflow-hidden">
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
                                className="absolute inset-x-3 bottom-3 z-10 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200 rounded-lg bg-gray-900 text-white text-xs font-semibold py-2.5 flex items-center justify-center gap-1.5 hover:bg-black"
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
              <div className="grid grid-cols-[260px_1fr]">
                {/* Col 1: gray rail */}
                <div className="bg-gray-50 px-6 py-7 flex flex-col">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-4">Customize</h3>
                  <ul className="-mx-2">
                    <li>
                      <Link href="/customize" onClick={closeMenus} className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-[15px] font-bold text-gray-900">
                        Custom design <ChevronRight className="w-4 h-4" />
                      </Link>
                    </li>
                    <li>
                      <Link href="/customize" onClick={closeMenus} className="block rounded-lg px-3 py-2.5 text-[15px] text-gray-500 hover:text-gray-900 transition-colors">DTF printing</Link>
                    </li>
                    <li>
                      <Link href="/shop" onClick={closeMenus} className="block rounded-lg px-3 py-2.5 text-[15px] text-gray-500 hover:text-gray-900 transition-colors">Printable garments</Link>
                    </li>
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

                {/* Col 2 + 3: heading/links + big imagery */}
                <div className="px-10 py-8 min-h-[340px]">
                  <div className="flex gap-10">
                    <div className="w-[190px] shrink-0">
                      <h3 className="text-2xl font-extrabold uppercase tracking-tight text-gray-900">Customize</h3>
                      <p className="mt-6 mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Get started</p>
                      <ul className="space-y-2">
                        <li><Link href="/customize" onClick={closeMenus} className="text-sm text-gray-600 hover:text-gray-900">Add your design</Link></li>
                        <li><Link href="/customize" onClick={closeMenus} className="text-sm text-gray-600 hover:text-gray-900">DTF printing</Link></li>
                        <li><Link href="/shop" onClick={closeMenus} className="text-sm text-gray-600 hover:text-gray-900">Printable garments</Link></li>
                      </ul>
                      <p className="mt-4 text-sm text-gray-500 leading-relaxed">Add your own design or text — printed on demand.</p>
                      <Link href="/customize" onClick={closeMenus} className="mt-6 inline-block text-xs font-semibold text-primary hover:underline">Start now →</Link>
                    </div>
                    <div className="flex flex-1 flex-wrap gap-6">
                      {allItems.slice(0, 4).map((p) => (
                        <Link key={p.Id} href="/customize" onClick={closeMenus} className="group w-[200px] shrink-0 block">
                          <div className="relative aspect-[4/5] rounded-lg bg-gray-100 overflow-hidden">
                            {p.ImageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.ImageUrl} alt={p.Name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">No image</div>
                            )}
                          </div>
                          <p className="mt-3 text-sm font-bold text-gray-900">{p.Name}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
        </AnimatePresence>
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
              <Link href="/gallery" onClick={closeMenus} className="flex items-center justify-between py-3 text-[15px] text-gray-600 border-b border-gray-100">
                Gallery <ChevronRight className="w-4 h-4 text-gray-400" />
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

      {/* Search drawer (slides down from the top) */}
      <AnimatePresence>
        {searchOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[55] bg-black/40"
              onClick={() => setSearchOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ y: "-100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-100%" }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed top-0 inset-x-0 z-[60] bg-white shadow-2xl"
            >
              <div className="max-w-3xl mx-auto px-5 py-7">
                <form onSubmit={submitSearch} className="relative border-b-2 border-gray-900">
                  <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search products..."
                    className="w-full bg-transparent pl-8 pr-10 py-3 text-lg text-gray-900 placeholder-gray-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setSearchOpen(false)}
                    aria-label="Close search"
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </form>
                {q.trim().length >= 2 ? (
                  <div className="mt-5">
                    {searching && results.length === 0 ? (
                      <p className="text-sm text-gray-400">Searching…</p>
                    ) : results.length > 0 ? (
                      <>
                        <div className="divide-y divide-gray-100">
                          {results.map((p) => (
                            <Link key={p.Id} href={`/product/${p.Slug}`} onClick={closeMenus} className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded hover:bg-gray-50">
                              <div className="w-12 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                                {p.ImageUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.ImageUrl} alt={p.Name} className="w-full h-full object-cover" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 line-clamp-1">{p.Name}</p>
                                <p className="text-sm font-bold text-gray-900">{money(p.SellingPrice)}</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                        <Link href={`/shop?q=${encodeURIComponent(q.trim())}`} onClick={closeMenus} className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
                          See all results →
                        </Link>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">No products found for &ldquo;{q.trim()}&rdquo;.</p>
                    )}
                  </div>
                ) : (
                  categories.length > 0 && (
                    <div className="mt-6">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-3">Trending searches</p>
                      <div className="flex flex-wrap gap-2">
                        {categories.map((c) => (
                          <Link
                            key={c.Id}
                            href={`/category/${c.Slug}`}
                            onClick={closeMenus}
                            className="px-3.5 py-1.5 rounded-full border border-gray-300 text-sm text-gray-700 hover:border-gray-900 hover:text-gray-900 transition-colors"
                          >
                            {c.Name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
