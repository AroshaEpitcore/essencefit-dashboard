import Link from "next/link";
import { Facebook, Instagram, Phone, Mail, MessageCircle, Truck, Banknote, ShieldCheck } from "lucide-react";
import type { StoreCategory } from "@/lib/storefront";
import type { StoreSettings } from "@/lib/storeSettings";

/* Premium storefront footer: prominent brand block with socials + WhatsApp
   CTA, four link columns, a delivery/COD/quality trust row, and the
   oversized brand wordmark bleeding off the bottom edge (kept as-is). */
export default function StoreFooter({
  settings,
  categories,
}: {
  settings: StoreSettings;
  categories: StoreCategory[];
}) {
  const brandLogo = settings.logoLight || settings.logo;
  const socialClass =
    "w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-gray-300 hover:bg-primary hover:border-primary hover:text-white transition-colors";
  const linkClass = "text-gray-400 hover:text-white transition-colors";
  const headingClass = "text-white text-sm font-semibold uppercase tracking-[0.15em] mb-4";

  // WhatsApp deep link from the store phone (Sri Lanka: leading 0 -> 94).
  const waDigits = (settings.contactPhone || "").replace(/\D/g, "");
  const waLink = waDigits ? `https://wa.me/${waDigits.startsWith("0") ? "94" + waDigits.slice(1) : waDigits}` : null;

  return (
    <footer className="relative overflow-hidden bg-black text-gray-400 mt-20">
      {/* accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      {/* soft glow behind the brand column */}
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 max-w-[1920px] mx-auto px-4 sm:px-6 pt-16 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2">
            {brandLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brandLogo} alt={settings.storeName} className="h-12 w-auto mb-5" />
            ) : (
              <h3 className="text-white text-2xl font-bold tracking-wide mb-5">{settings.storeName}</h3>
            )}
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
              Premium apparel and custom DTF prints, made in Sri Lanka.
              Island-wide delivery, cash on delivery.
            </p>
            <div className="flex items-center gap-3 mt-6">
              {settings.social.facebook && (
                <a href={settings.social.facebook} target="_blank" rel="noopener noreferrer" className={socialClass} aria-label="Facebook"><Facebook className="w-4 h-4" /></a>
              )}
              {settings.social.instagram && (
                <a href={settings.social.instagram} target="_blank" rel="noopener noreferrer" className={socialClass} aria-label="Instagram"><Instagram className="w-4 h-4" /></a>
              )}
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 inline-flex items-center gap-2 rounded-lg bg-primary text-white text-sm font-semibold px-4 py-2 hover:bg-primary/90 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" /> Chat on WhatsApp
                </a>
              )}
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className={headingClass}>Shop</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/shop" className={linkClass}>All products</Link></li>
              <li><Link href="/deals" className={linkClass}>Deals</Link></li>
              {categories.slice(0, 4).map((c) => (
                <li key={c.Id}><Link href={`/category/${c.Slug}`} className={linkClass}>{c.Name}</Link></li>
              ))}
            </ul>
          </div>

          {/* Explore */}
          <div>
            <h4 className={headingClass}>Explore</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/customize" className={linkClass}>Customize &amp; DTF print</Link></li>
              <li><Link href="/gallery" className={linkClass}>Custom orders gallery</Link></li>
              <li><Link href="/feedback" className={linkClass}>Customer feedback</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className={headingClass}>Account</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/account" className={linkClass}>My account</Link></li>
              <li><Link href="/account/orders" className={linkClass}>Track orders</Link></li>
              <li><Link href="/wishlist" className={linkClass}>Wishlist</Link></li>
              <li><Link href="/cart" className={linkClass}>Cart</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className={headingClass}>Contact</h4>
            <ul className="space-y-3 text-sm">
              {settings.contactPhone && (
                <li className="flex items-center gap-2.5"><Phone className="w-4 h-4 text-primary shrink-0" /> {settings.contactPhone}</li>
              )}
              {settings.contactEmail && (
                <li className="flex items-center gap-2.5"><Mail className="w-4 h-4 text-primary shrink-0" /> {settings.contactEmail}</li>
              )}
            </ul>
          </div>
        </div>

        {/* Trust row */}
        <div className="border-t border-white/10 mt-12 pt-8 grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0"><Truck className="w-5 h-5 text-primary" /></span>
            <div>
              <p className="text-white font-semibold">Island-wide delivery</p>
              <p className="text-xs text-gray-500">Anywhere in Sri Lanka</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0"><Banknote className="w-5 h-5 text-primary" /></span>
            <div>
              <p className="text-white font-semibold">Cash on delivery</p>
              <p className="text-xs text-gray-500">Pay when it arrives</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0"><ShieldCheck className="w-5 h-5 text-primary" /></span>
            <div>
              <p className="text-white font-semibold">Quality guaranteed</p>
              <p className="text-xs text-gray-500">Premium fabrics &amp; prints</p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <span>© {new Date().getFullYear()} {settings.storeName}. All rights reserved.</span>
          <Link href="/cookie-policy" className="hover:text-white transition-colors">Cookie Policy</Link>
        </div>
      </div>

      {/* Oversized brand wordmark bleeding off the bottom edge */}
      <div aria-hidden className="pointer-events-none select-none relative">
        <span className="block text-center font-black tracking-tighter leading-none text-white/10 text-[15vw] whitespace-nowrap pb-2">
          {settings.storeName}
        </span>
      </div>
    </footer>
  );
}
