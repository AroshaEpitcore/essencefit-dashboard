"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ShoppingCart, Search, Menu, X, Heart, ChevronDown } from "lucide-react";
import { useCart } from "./CartContext";
import { useWishlist } from "./WishlistContext";
import AccountMenu, { type NavCustomer } from "./AccountMenu";
import { money } from "./format";
import type { StoreCategory, StoreProduct } from "@/lib/storefront";
import type { StoreSettings } from "@/lib/storeSettings";

export default function StoreHeader({
  settings,
  categories,
  customer,
  featured,
}: {
  settings: StoreSettings;
  categories: StoreCategory[];
  customer: NavCustomer;
  featured: StoreProduct[];
}) {
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";

  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<null | "shop" | "customize">(null);
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
  const iconCls = onDark ? "text-white hover:text-white/70" : "text-gray-800 hover:text-primary";
  const linkCls = onDark ? "text-white/90 hover:text-white" : "text-gray-700 hover:text-primary";

  // Imagery for the mega-menu right panels: featured products, falling back to
  // category tiles when no products are flagged featured.
  const promoItems = featured.length
    ? featured.map((p) => ({ href: `/product/${p.Slug}`, img: p.ImageUrl, name: p.Name, price: money(p.SellingPrice) }))
    : categories.filter((c) => c.ImageUrl).map((c) => ({ href: `/category/${c.Slug}`, img: c.ImageUrl, name: c.Name, price: "" }));

  const navBtn = `${linkCls} inline-flex items-center gap-1 cursor-pointer`;

  return (
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
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 relative flex items-center h-16 md:h-24">
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
          <div className="hidden md:block absolute left-0 right-0 top-full bg-white shadow-xl border-t border-gray-100">
            <div className="max-w-[1920px] mx-auto px-6 py-8">
              {openMenu === "shop" && (
                <div className="grid grid-cols-[1fr_1.5fr] gap-12">
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Shop by category</h3>
                    <ul className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
                      <li><Link href="/shop" onClick={closeMenus} className="text-gray-700 hover:text-primary">All products</Link></li>
                      {categories.map((c) => (
                        <li key={c.Id}><Link href={`/category/${c.Slug}`} onClick={closeMenus} className="text-gray-700 hover:text-primary">{c.Name}</Link></li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Featured</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {promoItems.slice(0, 3).map((it, i) => (
                        <Link key={i} href={it.href} onClick={closeMenus} className="group block">
                          <div className="aspect-[3/4] bg-gray-100 overflow-hidden">
                            {it.img && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={it.img} alt={it.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            )}
                          </div>
                          <p className="mt-2 text-xs text-gray-800 line-clamp-1">{it.name}</p>
                          {it.price && <p className="text-xs font-semibold text-gray-900">{it.price}</p>}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {openMenu === "customize" && (
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
              )}
            </div>
          </div>
        )}
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
            <Link href="/shop" onClick={closeMenus} className="block py-2 text-gray-700">All products</Link>
            {categories.map((c) => (
              <Link key={c.Id} href={`/category/${c.Slug}`} onClick={closeMenus} className="block py-2 text-gray-700">{c.Name}</Link>
            ))}
            <Link href="/deals" onClick={closeMenus} className="block py-2 text-primary font-semibold">Deals</Link>
            <Link href="/customize" onClick={closeMenus} className="block py-2 text-gray-700">Customize &amp; DTF Print</Link>
            <Link href="/wishlist" onClick={closeMenus} className="block py-2 text-gray-700">Wishlist</Link>
            <Link href="/account" onClick={closeMenus} className="block py-2 text-gray-700">My account</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
