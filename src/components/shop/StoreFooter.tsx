import Link from "next/link";
import { Facebook, Instagram, Phone, Mail, MessageCircle, Truck, Banknote, ShieldCheck } from "lucide-react";
import type { StoreCategory } from "@/lib/storefront";
import type { StoreSettings } from "@/lib/storeSettings";
import { waHref } from "@/lib/wa";

// lucide has no TikTok brand icon, so it's inlined (simple-icons path).
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

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

  // WhatsApp deep link — prefer the dedicated WhatsApp number from settings,
  // fall back to the store phone.
  const waLink = waHref(settings.social.whatsapp || settings.contactPhone);

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
              {settings.social.tiktok && (
                <a href={settings.social.tiktok} target="_blank" rel="noopener noreferrer" className={socialClass} aria-label="TikTok"><TikTokIcon className="w-4 h-4" /></a>
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
              <li><Link href="/about" className={linkClass}>About us</Link></li>
              <li><Link href="/contact" className={linkClass}>Contact us</Link></li>
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
