"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HeroSlide } from "@/lib/storeSettings";

const DURATION = 6500; // ms per slide

export default function Hero({ slides, storeName }: { slides: HeroSlide[]; storeName: string }) {
  const [i, setI] = useState(0);
  const n = slides.length;

  // Auto-advance; the timeout is re-created on every slide change so manual
  // navigation also resets the timer (and keeps the progress dot in sync).
  useEffect(() => {
    if (n <= 1) return;
    const t = setTimeout(() => setI((p) => (p + 1) % n), DURATION);
    return () => clearTimeout(t);
  }, [i, n]);

  // No slides configured → a clean default hero.
  if (n === 0) {
    return (
      <section className="relative h-dvh w-full overflow-hidden bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center text-center px-6">
        <div className="max-w-2xl">
          <h1 className="text-white text-4xl sm:text-6xl font-extrabold tracking-tight">{storeName}</h1>
          <p className="text-white/80 mt-4 text-lg">Quality apparel, delivered island-wide.</p>
          <Link href="/shop" className="mt-8 inline-block bg-white text-gray-900 px-9 py-3.5 rounded-full font-semibold hover:bg-gray-100 transition-colors">
            Shop now
          </Link>
        </div>
        <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/60 text-xs tracking-widest">
          ADD HERO SLIDES IN STORE SETTINGS
        </p>
      </section>
    );
  }

  const s = slides[i];
  const alignWrap =
    s.align === "left" ? "items-start text-left"
    : s.align === "right" ? "items-end text-right"
    : "items-center text-center";

  return (
    <section className="relative h-dvh w-full overflow-hidden bg-black">
      {/* Media layers — crossfade */}
      {slides.map((slide, idx) => (
        <div
          key={idx}
          className={`absolute inset-0 transition-opacity ease-in-out duration-[1200ms] ${idx === i ? "opacity-100" : "opacity-0"}`}
        >
          {slide.type === "video" ? (
            <video
              src={slide.src}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className="w-full h-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.src} alt={slide.heading || storeName} className="w-full h-full object-cover" />
          )}
        </div>
      ))}

      {/* Legibility gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-black/35 pointer-events-none" />

      {/* Slide content (re-animates on each change via key) */}
      <div className={`absolute inset-0 z-10 flex flex-col justify-center px-6 sm:px-12 lg:px-24 ${alignWrap}`}>
        <div key={i} className="max-w-3xl animate-[heroFadeUp_800ms_ease-out]">
          {s.subheading && (
            <p className="text-white/85 text-sm sm:text-base font-medium tracking-[0.2em] uppercase mb-3">
              {s.subheading}
            </p>
          )}
          {s.heading && (
            <h1 className="text-white font-extrabold tracking-tight leading-[1.05] text-4xl sm:text-6xl lg:text-7xl drop-shadow-sm">
              {s.heading}
            </h1>
          )}
          {s.ctaText && s.ctaLink && (
            <Link
              href={s.ctaLink}
              className="mt-7 inline-block bg-white text-gray-900 px-9 py-3.5 rounded-full font-semibold hover:bg-gray-100 transition-colors"
            >
              {s.ctaText}
            </Link>
          )}
        </div>
      </div>

      {/* Progress-dot loader */}
      {n > 1 && (
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5">
          {slides.map((_, k) => (
            <button
              key={k}
              onClick={() => setI(k)}
              aria-label={`Go to slide ${k + 1}`}
              className={`h-2 rounded-full overflow-hidden transition-all duration-300 ${k === i ? "w-8 bg-white/40" : "w-2 bg-white/45 hover:bg-white/75"}`}
            >
              {k === i && <span key={i} className="block h-full bg-white animate-[heroProgress_6500ms_linear_forwards]" />}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
