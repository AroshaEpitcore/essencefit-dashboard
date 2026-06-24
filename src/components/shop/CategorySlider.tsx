"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { StoreCategory } from "@/lib/storefront";

/* Homepage category slider — large black square tiles with the image
   filling the card and the category name overlaid bottom-left.
   Same smooth scroll-snap mechanics as ProductSlider. */
export default function CategorySlider({
  categories,
  title = "Shop by Category",
}: {
  categories: StoreCategory[];
  title?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  if (!categories.length) return null;

  function scroll(dir: -1 | 1) {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  return (
    <section className="max-w-[1920px] mx-auto px-4 sm:px-6 py-10">
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
        </div>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((c) => (
          <Link
            key={c.Id}
            href={`/category/${c.Slug}`}
            data-card
            className="group snap-start shrink-0 w-[80%] sm:w-[48%] lg:w-[32%]"
          >
            <div className="relative aspect-square bg-black overflow-hidden">
              {c.ImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.ImageUrl}
                  alt={c.Name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              )}
              {/* subtle gradient so the label stays readable over any image */}
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
              <span className="absolute bottom-4 left-4 text-white text-lg font-semibold tracking-wide">
                {c.Name}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
