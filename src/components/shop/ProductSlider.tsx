"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "./ProductCard";
import type { StoreProduct } from "@/lib/storefront";

/* Reusable homepage product slider (New Arrivals, Deals, Featured, …).
   Smooth, dependency-free horizontal slider built on CSS scroll-snap;
   the arrows scroll by one card at a time. */
export default function ProductSlider({
  products,
  title,
  href = "/shop",
}: {
  products: StoreProduct[];
  title: string;
  href?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  if (!products.length) return null;

  function scroll(dir: -1 | 1) {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    // Advance by the width of one card (incl. gap), falling back to ~80% of the viewport.
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  return (
    <section className="max-w-[1600px] mx-auto px-4 sm:px-6 py-10">
      {/* Top row — title left, arrows + shop-all right (see reference design) */}
      <div className="flex items-end justify-between mb-6">
        <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wide text-gray-900 inline-block border-b-2 border-primary pb-1">
          {title}
        </h2>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label="Previous"
            className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:border-gray-900 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label="Next"
            className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:border-gray-900 hover:text-gray-900 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <Link
            href={href}
            className="ml-1 text-sm font-semibold uppercase tracking-wide text-gray-900 flex items-center gap-1 hover:gap-2 transition-all"
          >
            Shop all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p) => (
          <div
            key={p.Id}
            data-card
            className="snap-start shrink-0 w-[70%] sm:w-[45%] md:w-[30%] lg:w-[23%]"
          >
            <ProductCard p={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
