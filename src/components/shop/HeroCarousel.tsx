"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HeroSlide } from "@/lib/storeSettings";

export default function HeroCarousel({ slides, storeName }: { slides: HeroSlide[]; storeName: string }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setI((p) => (p + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  if (!slides.length) {
    return (
      <section className="bg-gradient-to-r from-gray-900 to-gray-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-20 sm:py-28 text-center">
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-4">{storeName}</h1>
          <p className="text-gray-200 mb-8 max-w-xl mx-auto">
            Quality apparel delivered island-wide. Shop the latest styles with cash on delivery.
          </p>
          <Link href="/shop" className="inline-block bg-primary text-white px-8 py-3 rounded-full font-semibold hover:bg-primary/90 transition-colors">
            Shop now
          </Link>
        </div>
      </section>
    );
  }

  const s = slides[i];
  return (
    <section className="relative overflow-hidden bg-gray-100">
      <Link href={s.link || "/shop"} className="block">
        <div className="relative aspect-[16/7] sm:aspect-[16/6] max-h-[480px] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.image} alt={s.title || storeName} className="w-full h-full object-cover" />
          {(s.title || s.subtitle) && (
            <div className="absolute inset-0 bg-black/30 flex flex-col items-start justify-center px-6 sm:px-16">
              {s.title && <h2 className="text-white text-2xl sm:text-5xl font-extrabold max-w-lg">{s.title}</h2>}
              {s.subtitle && <p className="text-white/90 mt-2 text-sm sm:text-lg max-w-md">{s.subtitle}</p>}
              <span className="mt-5 inline-block bg-primary text-white px-6 py-2.5 rounded-full font-semibold text-sm sm:text-base">
                Shop now
              </span>
            </div>
          )}
        </div>
      </Link>

      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((_, k) => (
            <button
              key={k}
              onClick={(e) => { e.preventDefault(); setI(k); }}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${k === i ? "bg-primary" : "bg-white/70"}`}
              aria-label={`Slide ${k + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
