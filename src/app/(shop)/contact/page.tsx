import type { Metadata } from "next";
import Link from "next/link";
import { Phone, Mail, MessageCircle, Facebook, Instagram, Clock, Truck } from "lucide-react";
import { getPublicStoreSettings } from "@/lib/storeSettings";
import { waHref } from "@/lib/wa";
import ContactWhatsAppForm from "@/components/shop/ContactWhatsAppForm";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch — WhatsApp, phone, email or social media. We're happy to help with orders, sizing and custom prints.",
};

export default async function ContactPage() {
  const settings = await getPublicStoreSettings();
  const waLink = waHref(settings.social.whatsapp || settings.contactPhone);

  const cardClass = "rounded-2xl border border-gray-200 bg-white p-6 flex flex-col items-start gap-3 hover:border-gray-900 hover:shadow-lg transition-all";
  const iconWrap = "w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
      {/* Heading */}
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary mb-3">Contact us</p>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-gray-900">
          We&apos;d love to hear from you
        </h1>
        <p className="mt-4 text-gray-500 leading-relaxed">
          Questions about an order, sizing, or a custom DTF print you have in mind?
          The fastest way to reach {settings.storeName} is WhatsApp — but we&apos;re on all of these.
        </p>
      </div>

      {/* Contact cards */}
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {waLink && (
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-black text-white p-6 flex flex-col items-start gap-3 hover:bg-gray-900 hover:shadow-lg transition-all">
            <span className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </span>
            <div>
              <p className="font-bold">WhatsApp</p>
              <p className="text-sm text-gray-400 mt-1">Fastest replies — orders, questions &amp; custom prints</p>
            </div>
            <span className="mt-auto text-sm font-semibold text-primary">Chat with us →</span>
          </a>
        )}
        {settings.contactPhone && (
          <a href={`tel:${settings.contactPhone.replace(/\s/g, "")}`} className={cardClass}>
            <span className={iconWrap}><Phone className="w-5 h-5" /></span>
            <div>
              <p className="font-bold text-gray-900">Call us</p>
              <p className="text-sm text-gray-500 mt-1">{settings.contactPhone}</p>
            </div>
            <span className="mt-auto text-sm font-semibold text-gray-900">Call now →</span>
          </a>
        )}
        {settings.contactEmail && (
          <a href={`mailto:${settings.contactEmail}`} className={cardClass}>
            <span className={iconWrap}><Mail className="w-5 h-5" /></span>
            <div>
              <p className="font-bold text-gray-900">Email us</p>
              <p className="text-sm text-gray-500 mt-1 break-all">{settings.contactEmail}</p>
            </div>
            <span className="mt-auto text-sm font-semibold text-gray-900">Write to us →</span>
          </a>
        )}
      </div>

      {/* Message form + side info */}
      <div className="mt-14 grid grid-cols-1 lg:grid-cols-5 gap-10">
        <div className="lg:col-span-3">
          <h2 className="text-2xl font-bold text-gray-900">Send us a message</h2>
          <p className="mt-2 text-sm text-gray-500">
            Type it here and we&apos;ll open WhatsApp with everything filled in.
          </p>
          <div className="mt-6">
            {waLink ? (
              <ContactWhatsAppForm waLink={waLink} />
            ) : (
              <p className="text-sm text-gray-500">
                Reach us by email{settings.contactEmail ? ` at ${settings.contactEmail}` : ""} and we&apos;ll get back to you.
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl bg-gray-50 border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> When we reply
            </h3>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              We answer WhatsApp messages every day and usually within a few hours.
              Order updates are always sent to you on WhatsApp.
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary" /> Delivery &amp; payment
            </h3>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              Island-wide delivery anywhere in Sri Lanka with cash on delivery —
              you only pay when your order arrives.
            </p>
          </div>
          {(settings.social.facebook || settings.social.instagram || settings.social.tiktok) && (
            <div className="rounded-2xl bg-gray-50 border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900">Follow us</h3>
              <div className="mt-3 flex items-center gap-2.5">
                {settings.social.facebook && (
                  <a href={settings.social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-900 hover:border-gray-900 hover:text-white transition-colors">
                    <Facebook className="w-4 h-4" />
                  </a>
                )}
                {settings.social.instagram && (
                  <a href={settings.social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-900 hover:border-gray-900 hover:text-white transition-colors">
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
                {settings.social.tiktok && (
                  <a href={settings.social.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-900 hover:border-gray-900 hover:text-white transition-colors">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="w-4 h-4">
                      <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="mt-16 rounded-2xl bg-gray-50 border border-gray-200 px-6 py-8 sm:px-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Have a design of your own?</h3>
          <p className="text-sm text-gray-500 mt-1">Send us your artwork and we&apos;ll print it — see what other customers made.</p>
        </div>
        <div className="flex gap-3 shrink-0">
          <Link href="/customize" className="rounded-lg bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 hover:bg-gray-700 transition-colors">Customize now</Link>
          <Link href="/gallery" className="rounded-lg border border-gray-300 text-gray-900 text-sm font-semibold px-5 py-2.5 hover:border-gray-900 transition-colors">View gallery</Link>
        </div>
      </div>
    </div>
  );
}
