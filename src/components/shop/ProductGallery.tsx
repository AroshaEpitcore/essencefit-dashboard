"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";

/* Two different layouts by breakpoint (both rendered, toggled via CSS so there's
   no client-only breakpoint detection/hydration flash):
   - Desktop (sm+): every photo shown stacked, full-height, scrolling the page
     scrolls through them; a thumbnail rail on the left tracks scroll position via
     IntersectionObserver and highlights whichever shot is in view, clicking one
     scrolls to it.
   - Mobile (<sm): one large image at a time with a zoom button, and a horizontal
     row of small thumbnails below it that swap the active image on click.
   Clicking any main image (either layout) opens the shared full-screen lightbox. */
export default function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const list = images.length ? images : [];
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => setActive(0), [images]);

  // Desktop: highlight the thumbnail for whichever image is most visible while scrolling.
  useEffect(() => {
    if (list.length < 2) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!mostVisible) return;
        const idx = itemRefs.current.findIndex((el) => el === mostVisible.target);
        if (idx !== -1) setActive(idx);
      },
      { threshold: [0.25, 0.5, 0.75] },
    );
    itemRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [list]);

  const scrollToImage = (i: number) => {
    setActive(i);
    itemRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
    return <div className="aspect-square bg-gray-100 flex items-center justify-center text-gray-300">No image</div>;
  }

  return (
    <>
      {/* Desktop — vertical thumbnail rail (scroll-synced) + every photo stacked */}
      <div className="hidden sm:flex gap-3">
        {list.length > 1 && (
          <div
            className="flex flex-col gap-2 w-20 self-start sticky shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ top: "calc(var(--header-h, 132px) + 1rem)" }}
          >
            {list.map((url, i) => (
              <button
                key={url + i}
                type="button"
                onClick={() => scrollToImage(i)}
                aria-label={`View image ${i + 1}`}
                className={`relative w-full h-20 shrink-0 overflow-hidden rounded-lg bg-gray-100 border ${
                  active === i ? "border-gray-900" : "border-transparent hover:border-gray-300"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 flex flex-col gap-3">
          {list.map((url, i) => (
            <div
              key={url + i}
              ref={(el) => { itemRefs.current[i] = el; }}
              className="aspect-square overflow-hidden rounded-lg bg-gray-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${name} ${i + 1}`}
                onClick={() => open(i)}
                {...(i === 0 ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
                decoding="async"
                className="w-full h-full object-cover cursor-zoom-in"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile — one image at a time + a horizontal thumbnail row to swap it */}
      <div className="flex sm:hidden flex-col gap-3">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={list[active]}
            alt={name}
            onClick={() => open(active)}
            className="w-full h-full object-cover cursor-zoom-in"
          />
          <button
            type="button"
            onClick={() => open(active)}
            aria-label="Zoom image"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow-sm"
          >
            <ZoomIn className="w-4 h-4 text-gray-700" />
          </button>
        </div>

        {list.length > 1 && (
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {list.map((url, i) => (
              <button
                key={url + i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1}`}
                className={`relative w-16 h-16 shrink-0 overflow-hidden rounded-lg bg-gray-100 border ${
                  active === i ? "border-gray-900" : "border-transparent hover:border-gray-300"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

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
