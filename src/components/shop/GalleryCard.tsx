"use client";

import { useState } from "react";
import { Images, Share2, Check } from "lucide-react";
import GalleryLightbox from "./GalleryLightbox";
import type { GalleryItem } from "@/lib/storefront";

/* Card for one custom order: the main photo (hover shows the next one, like
   the product card), the customer's name + optional caption, then a row of
   small square thumbnails of every image (final photos + artworks) —
   hovering a thumbnail swaps the main photo to it, clicking opens the
   lightbox at that image. A small inset shows the customer's artwork.
   `onDark` switches the text/border colors for the black home page panel.
   `shareable` (used on /gallery only) adds a share button — native share
   sheet when available, else copy-link; shared URLs (?item=<id>) auto-open
   the lightbox via `autoOpen`. */
export default function GalleryCard({
  item,
  onDark = false,
  shareable = false,
  autoOpen = false,
}: {
  item: GalleryItem;
  onDark?: boolean;
  shareable?: boolean;
  autoOpen?: boolean;
}) {
  const [lightbox, setLightbox] = useState<number | null>(autoOpen ? 0 : null);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/gallery?item=${item.Id}`;
    const data = { title: `${item.CustomerName} — Custom Order`, text: item.Caption || `Check out ${item.CustomerName}'s custom order`, url };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(data);
      } catch {
        /* user dismissed the share sheet */
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        /* clipboard unavailable */
      }
    }
  }

  const allImages = [...item.Images, ...item.Artworks];
  const count = allImages.length;
  if (count === 0) return null;

  // Cover + hover-preview cycle through the FINAL product photos only —
  // artworks stay in the insets and at the end of the lightbox.
  const finals = item.Images.length ? item.Images : allImages;
  const idx = Math.min(active, finals.length - 1);
  const cover = finals[idx];
  const hoverImage = finals.length > 1 ? finals[(idx + 1) % finals.length] : null;

  return (
    <>
      <div className="group/card w-full text-left">
        <div className="relative">
        {/* Main image — click zooms; hovering shows the next image */}
        <button
          type="button"
          onClick={() => setLightbox(idx)}
          className="group relative block w-full aspect-square rounded-lg bg-gray-100 overflow-hidden"
          aria-label={`View ${item.CustomerName}'s custom order`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt={`${item.CustomerName}'s custom order`}
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${hoverImage ? "group-hover:opacity-0" : ""}`}
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

          {/* Customer's artwork insets — all artworks side by side */}
          {item.Artworks.length > 0 && (
            <span className="absolute bottom-2 left-2 flex gap-1.5">
              {item.Artworks.slice(0, 3).map((url, i) => (
                <span key={url + i} className="block w-14 h-14 rounded-lg overflow-hidden border-2 border-white shadow-md bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Customer's artwork" loading="lazy" className="w-full h-full object-cover" />
                </span>
              ))}
              {item.Artworks.length > 3 && (
                <span className="w-14 h-14 rounded-lg border-2 border-white shadow-md bg-black/60 text-white flex items-center justify-center text-xs font-semibold">
                  +{item.Artworks.length - 3}
                </span>
              )}
            </span>
          )}

          {/* Image count badge */}
          {count > 1 && (
            <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 text-white text-[11px] font-semibold px-2 py-1">
              <Images className="w-3 h-3" /> {count}
            </span>
          )}
        </button>

        {/* Share (gallery page only) — sibling of the image button, overlaid top-left */}
        {shareable && (
          <button
            type="button"
            onClick={share}
            aria-label={copied ? "Link copied" : `Share ${item.CustomerName}'s custom order`}
            title={copied ? "Link copied!" : "Share"}
            className="absolute top-2 left-2 z-10 w-8 h-8 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center text-gray-700 hover:text-primary shadow-sm"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Share2 className="w-4 h-4" />}
          </button>
        )}
        </div>

        <div className="mt-2.5">
          <p className={`text-base font-bold truncate transition-colors group-hover/card:text-primary ${onDark ? "text-white" : "text-gray-900"}`}>{item.CustomerName}</p>
          {item.Caption && <p className={`text-sm line-clamp-3 ${onDark ? "text-white/60" : "text-gray-500"}`}>{item.Caption}</p>}

          {/* Thumbnail squares — final product photos only (artworks stay as
              insets + in the lightbox); hover previews, click zooms */}
          {item.Images.length > 1 && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {item.Images.slice(0, 5).map((url, i) => (
                <button
                  key={url + i}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => { setActive(i); setLightbox(i); }}
                  aria-label={`View image ${i + 1}`}
                  className={`w-9 h-9 rounded-sm overflow-hidden border transition-colors ${
                    idx === i
                      ? onDark ? "border-white ring-1 ring-white" : "border-gray-900 ring-1 ring-gray-900"
                      : onDark ? "border-white/25 hover:border-white/60" : "border-gray-300 hover:border-gray-500"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
              {item.Images.length > 5 && <span className={`text-[11px] ${onDark ? "text-white/40" : "text-gray-400"}`}>+{item.Images.length - 5}</span>}
            </div>
          )}
        </div>
      </div>

      {lightbox !== null && (
        <GalleryLightbox images={allImages} startIndex={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
