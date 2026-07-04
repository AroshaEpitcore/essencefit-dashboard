"use client";

import { useState } from "react";
import GalleryLightbox from "./GalleryLightbox";
import type { FeedbackItem } from "@/lib/storefront";

/* Screenshot-first display for customer feedback (WhatsApp chats etc.).
   Two variants sharing one lightbox (reused from the gallery):
   - "marquee": fixed-height cards in the home page's duplicated-track
     marquee idiom (see ReviewsSection), pause on hover, click to zoom.
   - "wall": CSS multi-column flow at natural aspect ratio for the
     /feedback page — screenshots are tall/variable, columns avoid
     cropping the chat text. */
export default function FeedbackWall({
  items,
  variant = "wall",
}: {
  items: FeedbackItem[];
  variant?: "marquee" | "wall";
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (!items.length) return null;
  const images = items.map((f) => f.ImageUrl);

  const card = (f: FeedbackItem, i: number, sizing: string) => (
    <button
      key={`${f.Id}-${i}`}
      type="button"
      onClick={() => setLightbox(i % items.length)}
      className={`group relative overflow-hidden rounded-lg bg-gray-100 ${sizing}`}
      aria-label={f.CustomerName ? `Feedback from ${f.CustomerName}` : "Customer feedback"}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={f.ImageUrl}
        alt={f.CustomerName ? `Feedback from ${f.CustomerName}` : "Customer feedback screenshot"}
        loading="lazy"
        className={`transition-transform duration-500 group-hover:scale-[1.03] ${
          variant === "marquee" ? "h-full w-auto object-cover" : "w-full h-auto"
        }`}
      />
      {f.CustomerName && (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-left text-xs font-semibold text-white">
          {f.CustomerName}
        </span>
      )}
    </button>
  );

  return (
    <>
      {variant === "marquee" ? (
        // Continuous flow — duplicate the cards and translate -50% so it loops seamlessly.
        <div className="marquee-pause overflow-hidden -mx-1">
          <div
            className="flex w-max items-stretch animate-marquee"
            style={{ animationDuration: `${Math.max(items.length, 4) * 8}s` }}
          >
            {[...items, ...items].map((f, i) => (
              <div key={`${f.Id}-${i}`} className="h-64 sm:h-72 shrink-0 px-1.5">
                {card(f, i, "h-full")}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid [&>*]:block [&>*]:w-full">
          {items.map((f, i) => card(f, i, ""))}
        </div>
      )}

      {lightbox !== null && (
        <GalleryLightbox images={images} startIndex={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
