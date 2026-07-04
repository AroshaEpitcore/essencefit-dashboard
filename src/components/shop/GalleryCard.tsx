"use client";

import { useState } from "react";
import { Images } from "lucide-react";
import GalleryLightbox from "./GalleryLightbox";
import type { GalleryItem } from "@/lib/storefront";

/* Card for one custom order: the first final-product photo (hover swaps to
   the second when present), the customer's name + optional caption, a small
   inset thumbnail of the artwork the customer sent, and an image-count badge.
   Clicking opens the lightbox over all final photos plus the artwork.
   `onDark` switches the text colors for the black home page panel. */
export default function GalleryCard({ item, onDark = false }: { item: GalleryItem; onDark?: boolean }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  const cover = item.Images[0];
  const hoverImage = item.Images[1];
  const lightboxImages = item.ArtworkUrl ? [...item.Images, item.ArtworkUrl] : item.Images;
  const count = lightboxImages.length;

  if (!cover) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setLightbox(0)}
        className="group block w-full text-left"
        aria-label={`View ${item.CustomerName}'s custom order`}
      >
        <div className="relative aspect-square rounded-lg bg-gray-100 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt={`${item.CustomerName}'s custom order`}
            loading="lazy"
            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${hoverImage ? "group-hover:opacity-0" : ""}`}
          />
          {hoverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hoverImage}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105"
            />
          )}

          {/* Customer's artwork inset */}
          {item.ArtworkUrl && (
            <div className="absolute bottom-2 left-2 w-14 h-14 rounded-lg overflow-hidden border-2 border-white shadow-md bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.ArtworkUrl} alt="Customer's artwork" loading="lazy" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Image count badge */}
          {count > 1 && (
            <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 text-white text-[11px] font-semibold px-2 py-1">
              <Images className="w-3 h-3" /> {count}
            </span>
          )}
        </div>

        <div className="mt-2.5">
          <p className={`text-sm font-bold truncate transition-colors group-hover:text-primary ${onDark ? "text-white" : "text-gray-900"}`}>{item.CustomerName}</p>
          {item.Caption && <p className={`text-sm truncate ${onDark ? "text-white/60" : "text-gray-500"}`}>{item.Caption}</p>}
        </div>
      </button>

      {lightbox !== null && (
        <GalleryLightbox images={lightboxImages} startIndex={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
