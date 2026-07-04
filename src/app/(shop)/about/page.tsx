import type { Metadata } from "next";
import Link from "next/link";
import { Shirt, Palette, Truck, Banknote, MessageCircle, Sparkles, Package, HeartHandshake } from "lucide-react";
import { getPublicStoreSettings } from "@/lib/storeSettings";
import { waHref } from "@/lib/wa";

export const metadata: Metadata = {
  title: "About Us",
  description: "Premium apparel and custom DTF prints, made in Sri Lanka — island-wide delivery with cash on delivery.",
};

export default async function AboutPage() {
  const settings = await getPublicStoreSettings();
  const store = settings.storeName;
  const waLink = waHref(settings.social.whatsapp || settings.contactPhone);

  const values = [
    {
      icon: Shirt,
      title: "Premium fabrics",
      text: "We're picky about what we print on. Every tee and hoodie is chosen for feel, fit and how it holds up wash after wash.",
    },
    {
      icon: Palette,
      title: "Custom DTF prints",
      text: "Your artwork, printed in vivid, durable DTF — from a single one-off piece to a full drop for your brand or crew.",
    },
    {
      icon: Truck,
      title: "Island-wide delivery",
      text: "Colombo to Jaffna and everywhere in between — your order ships to any address in Sri Lanka.",
    },
    {
      icon: Banknote,
      title: "Cash on delivery",
      text: "No card needed, no risk. Check your order at the door and pay only when it's in your hands.",
    },
  ];

  const steps = [
    { icon: Sparkles, title: "Pick or design", text: "Shop the collection, or send us your own artwork for a custom DTF print." },
    { icon: MessageCircle, title: "Confirm on WhatsApp", text: "We confirm sizes, colours and placement with you before anything is printed." },
    { icon: Package, title: "We make it", text: "Your piece is printed and pressed with care, then checked before it leaves us." },
    { icon: Truck, title: "Delivered to you", text: "Packed and shipped island-wide — pay cash when it arrives." },
  ];

  return (
    <div>
      {/* Dark hero */}
      <section className="bg-black text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary mb-4">About {store}</p>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05] max-w-3xl">
            Wear something that&apos;s actually <span className="text-primary">yours</span>.
          </h1>
          <p className="mt-6 text-gray-400 leading-relaxed max-w-2xl">
            {store} is a Sri Lankan apparel studio built around one idea: quality clothing
            shouldn&apos;t be generic. We combine premium blanks with custom DTF printing, so what
            you wear — or what you gift — can be exactly what you imagined.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/shop" className="rounded-lg bg-primary text-white text-sm font-semibold px-6 py-3 hover:bg-primary/90 transition-colors">
              Shop the collection
            </Link>
            <Link href="/customize" className="rounded-lg border border-white/25 text-white text-sm font-semibold px-6 py-3 hover:bg-white hover:text-black transition-colors">
              Start a custom print
            </Link>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gray-900">Our story</h2>
          <div className="mt-5 space-y-4 text-gray-600 leading-relaxed">
            <p>
              We started {store} because finding good-quality, well-fitting apparel in Sri Lanka —
              let alone getting your own design printed on it properly — was harder than it should be.
              Prints cracked, fabrics faded, and &quot;custom&quot; usually meant compromise.
            </p>
            <p>
              So we did it ourselves: sourcing premium blanks, investing in DTF printing that stays
              vivid through real life and real washing, and building everything around a simple
              WhatsApp-first way of ordering that our customers actually use.
            </p>
            <p>
              Today we ship island-wide, print one-off pieces and full custom runs, and every order
              is checked by hand before it goes out. The custom pieces our customers dream up are
              the best part — <Link href="/gallery" className="text-primary font-semibold hover:underline">see them in the gallery</Link>.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {values.map((v) => (
            <div key={v.title} className="rounded-2xl border border-gray-200 bg-white p-6 hover:border-gray-900 hover:shadow-lg transition-all">
              <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <v.icon className="w-5 h-5" />
              </span>
              <h3 className="mt-4 font-bold text-gray-900">{v.title}</h3>
              <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <h2 className="text-3xl font-black tracking-tight text-gray-900">How it works</h2>
          <p className="mt-3 text-gray-500 max-w-xl">From idea to your doorstep in four steps.</p>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl bg-white border border-gray-200 p-6">
                <span className="absolute top-5 right-5 text-4xl font-black text-gray-100 leading-none select-none">{i + 1}</span>
                <span className="w-11 h-11 rounded-xl bg-gray-900 text-white flex items-center justify-center">
                  <s.icon className="w-5 h-5" />
                </span>
                <h3 className="mt-4 font-bold text-gray-900">{s.title}</h3>
                <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proof + CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="rounded-2xl bg-black text-white px-6 py-10 sm:px-12 sm:py-14 relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-[0.2em]">
              <HeartHandshake className="w-4 h-4" /> Loved by real customers
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight">
              Don&apos;t take our word for it
            </h2>
            <p className="mt-3 text-gray-400 leading-relaxed">
              Browse the custom pieces our customers designed and the feedback they sent us —
              then make something of your own.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/feedback" className="rounded-lg bg-white text-black text-sm font-semibold px-6 py-3 hover:bg-gray-200 transition-colors">
                Read customer feedback
              </Link>
              <Link href="/gallery" className="rounded-lg border border-white/25 text-white text-sm font-semibold px-6 py-3 hover:bg-white hover:text-black transition-colors">
                Custom orders gallery
              </Link>
              {waLink && (
                <a href={waLink} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-primary text-white text-sm font-semibold px-6 py-3 hover:bg-primary/90 transition-colors inline-flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" /> Chat on WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
