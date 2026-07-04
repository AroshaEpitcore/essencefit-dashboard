import Link from "next/link";
import { Facebook, Instagram, Phone, Mail } from "lucide-react";
import type { StoreCategory } from "@/lib/storefront";
import type { StoreSettings } from "@/lib/storeSettings";

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

  return (
    <footer className="relative overflow-hidden bg-black text-gray-400 mt-20">
      {/* accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="relative z-10 max-w-[1920px] mx-auto px-4 sm:px-6 pt-14 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            {brandLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brandLogo} alt={settings.storeName} className="h-9 w-auto mb-4" />
            ) : (
              <h3 className="text-white text-xl font-bold tracking-wide mb-4">{settings.storeName}</h3>
            )}
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
              Quality apparel, island-wide delivery, cash on delivery.
            </p>
            <div className="flex gap-3 mt-6">
              {settings.social.facebook && (
                <a href={settings.social.facebook} target="_blank" rel="noopener noreferrer" className={socialClass} aria-label="Facebook"><Facebook className="w-4 h-4" /></a>
              )}
              {settings.social.instagram && (
                <a href={settings.social.instagram} target="_blank" rel="noopener noreferrer" className={socialClass} aria-label="Instagram"><Instagram className="w-4 h-4" /></a>
              )}
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className={headingClass}>Shop</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/shop" className={linkClass}>All products</Link></li>
              <li><Link href="/deals" className={linkClass}>Deals</Link></li>
              <li><Link href="/feedback" className={linkClass}>Customer feedback</Link></li>
              {categories.slice(0, 4).map((c) => (
                <li key={c.Id}><Link href={`/category/${c.Slug}`} className={linkClass}>{c.Name}</Link></li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className={headingClass}>Account</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/account" className={linkClass}>My account</Link></li>
              <li><Link href="/account/orders" className={linkClass}>Track orders</Link></li>
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

        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
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
