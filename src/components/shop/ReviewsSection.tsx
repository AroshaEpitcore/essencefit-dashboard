"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ReviewCard from "./ReviewCard";
import type { StoreReview } from "@/lib/storefront";

/* Storefront reviews band — premium black testimonial section. Renders nothing
   when there are no reviews. Full-bleed black on the home page; a rounded black
   panel when nested (`bare`) inside an already-padded page (PDP / category). */
export default function ReviewsSection({
  reviews,
  title,
  variant = "grid",
  showProduct = false,
  bare = false,
  logo = null,
}: {
  reviews: StoreReview[];
  title: string;
  variant?: "grid" | "carousel";
  showProduct?: boolean;
  bare?: boolean;
  logo?: string | null;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  if (!reviews.length) return null;

  function scroll(dir: -1 | 1) {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-review]");
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  const header = (
    <div className="flex items-end justify-between mb-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary mb-2">Real customers</p>
        <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wide text-white inline-block border-b-2 border-primary pb-1">
          {title}
        </h2>
      </div>
      {variant === "carousel" && reviews.length > 1 && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => scroll(-1)} aria-label="Previous" className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:border-white hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => scroll(1)} aria-label="Next" className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:border-white hover:text-white transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );

  const body =
    variant === "carousel" ? (
      <div ref={trackRef} className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {reviews.map((r) => (
          <div key={r.Id} data-review className="snap-start shrink-0 w-[85%] sm:w-[45%] lg:w-[31%]">
            <ReviewCard review={r} showProduct={showProduct} logo={logo} />
          </div>
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reviews.map((r) => (
          <ReviewCard key={r.Id} review={r} showProduct={showProduct} logo={logo} />
        ))}
      </div>
    );

  const inner = (
    <>
      {header}
      {body}
    </>
  );

  if (bare) {
    return (
      <section className="relative overflow-hidden rounded-3xl bg-black px-5 sm:px-8 py-10">
        {/* soft brand glow */}
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">{inner}</div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden bg-black">
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[40rem] h-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative max-w-[1920px] mx-auto px-4 sm:px-6 py-16">{inner}</div>
    </section>
  );
}
