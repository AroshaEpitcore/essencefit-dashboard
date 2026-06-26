"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ReviewCard from "./ReviewCard";
import type { StoreReview } from "@/lib/storefront";

/* Storefront reviews block. Renders nothing when there are no reviews. A grid for
   the PDP/category pages and a scroll-snap carousel for the home page. */
export default function ReviewsSection({
  reviews,
  title,
  variant = "grid",
  showProduct = false,
  bare = false,
}: {
  reviews: StoreReview[];
  title: string;
  variant?: "grid" | "carousel";
  showProduct?: boolean;
  bare?: boolean; // drop the section's own max-width/padding when nested in a padded container
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

  return (
    <section className={bare ? "" : "max-w-[1920px] mx-auto px-4 sm:px-6 py-10"}>
      <div className="flex items-end justify-between mb-6">
        <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wide text-gray-900 inline-block border-b-2 border-primary pb-1">
          {title}
        </h2>
        {variant === "carousel" && reviews.length > 1 && (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => scroll(-1)} aria-label="Previous" className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:border-gray-900 hover:text-gray-900 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => scroll(1)} aria-label="Next" className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:border-gray-900 hover:text-gray-900 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {variant === "carousel" ? (
        <div ref={trackRef} className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {reviews.map((r) => (
            <div key={r.Id} data-review className="snap-start shrink-0 w-[85%] sm:w-[45%] lg:w-[31%]">
              <ReviewCard review={r} showProduct={showProduct} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((r) => (
            <ReviewCard key={r.Id} review={r} showProduct={showProduct} />
          ))}
        </div>
      )}
    </section>
  );
}
