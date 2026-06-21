"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/* Shows the product's images as a grid (up to a 2×2 of four). Switches with the
   selected colour because the parent passes the active image set. Clicking an
   image opens a full-screen lightbox with prev/next navigation. */
export default function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const list = images.length ? images : [];
  const [lightbox, setLightbox] = useState<number | null>(null);

  const open = useCallback((i: number) => setLightbox(i), []);
  const close = useCallback(() => setLightbox(null), []);
  const next = useCallback(
    () => setLightbox((i) => (i === null ? i : (i + 1) % list.length)),
    [list.length],
  );
  const prev = useCallback(
    () => setLightbox((i) => (i === null ? i : (i - 1 + list.length) % list.length)),
    [list.length],
  );

  // Keyboard nav + lock background scroll while the lightbox is open.
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightbox, close, next, prev]);

  if (list.length === 0) {
    return <div className="aspect-square  bg-gray-100 flex items-center justify-center text-gray-300">No image</div>;
  }

  return (
    <>
      {list.length === 1 ? (
        <div className="aspect-square  overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={list[0]}
            alt={name}
            onClick={() => open(0)}
            className="w-full h-full object-cover cursor-zoom-in"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {list.map((url, i) => (
            <div key={url + i} className="aspect-square  overflow-hidden bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${name} ${i + 1}`}
                onClick={() => open(i)}
                className="w-full h-full object-cover cursor-zoom-in"
              />
            </div>
          ))}
        </div>
      )}

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          {/* Close */}
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"
          >
            <X className="w-7 h-7" />
          </button>

          {/* Counter */}
          {list.length > 1 && (
            <span className="absolute top-5 left-1/2 -translate-x-1/2 text-sm text-white/80">
              {lightbox + 1} / {list.length}
            </span>
          )}

          {/* Prev */}
          {list.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prev(); }}
              aria-label="Previous image"
              className="absolute left-2 sm:left-4 p-2 sm:p-3 text-white/80 hover:text-white"
            >
              <ChevronLeft className="w-8 h-8 sm:w-10 sm:h-10" />
            </button>
          )}

          {/* Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={list[lightbox]}
            alt={`${name} ${lightbox + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[90vh] object-contain"
          />

          {/* Next */}
          {list.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); next(); }}
              aria-label="Next image"
              className="absolute right-2 sm:right-4 p-2 sm:p-3 text-white/80 hover:text-white"
            >
              <ChevronRight className="w-8 h-8 sm:w-10 sm:h-10" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
