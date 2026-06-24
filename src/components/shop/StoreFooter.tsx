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
  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <h3 className="text-white text-lg font-bold mb-3">{settings.storeName}</h3>
          <p className="text-sm text-gray-400">Quality apparel, island-wide delivery, cash on delivery.</p>
          <div className="flex gap-3 mt-4">
            {settings.social.facebook && (
              <a href={settings.social.facebook} className="hover:text-primary" aria-label="Facebook"><Facebook className="w-5 h-5" /></a>
            )}
            {settings.social.instagram && (
              <a href={settings.social.instagram} className="hover:text-primary" aria-label="Instagram"><Instagram className="w-5 h-5" /></a>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Shop</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/shop" className="hover:text-primary">All products</Link></li>
            <li><Link href="/deals" className="hover:text-primary">Deals</Link></li>
            {categories.slice(0, 4).map((c) => (
              <li key={c.Id}><Link href={`/category/${c.Slug}`} className="hover:text-primary">{c.Name}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Account</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/account" className="hover:text-primary">My account</Link></li>
            <li><Link href="/account/orders" className="hover:text-primary">Track orders</Link></li>
            <li><Link href="/cart" className="hover:text-primary">Cart</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Contact</h4>
          <ul className="space-y-2 text-sm">
            {settings.contactPhone && (
              <li className="flex items-center gap-2"><Phone className="w-4 h-4" /> {settings.contactPhone}</li>
            )}
            {settings.contactEmail && (
              <li className="flex items-center gap-2"><Mail className="w-4 h-4" /> {settings.contactEmail}</li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-800 py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} {settings.storeName}. All rights reserved.
      </div>
    </footer>
  );
}
