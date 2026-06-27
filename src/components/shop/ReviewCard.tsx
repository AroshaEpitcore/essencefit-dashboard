"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Quote, X } from "lucide-react";
import ReviewStars from "./ReviewStars";
import type { StoreReview } from "@/lib/storefront";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ review }: { review: StoreReview }) {
  return (
    <div className="w-11 h-11 rounded-full overflow-hidden bg-primary/20 text-primary flex items-center justify-center font-semibold shrink-0 ring-1 ring-white/10">
      {review.CustomerImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={review.CustomerImage} alt={review.CustomerName} className="w-full h-full object-cover" />
      ) : (
        initials(review.CustomerName)
      )}
    </div>
  );
}

export default function ReviewCard({
  review,
  showProduct = false,
  logo = null,
}: {
  review: StoreReview;
  showProduct?: boolean;
  logo?: string | null;
}) {
  const [zoom, setZoom] = useState<string | null>(null);
  const [open, setOpen] = useState(false); // full-review modal
  const [truncated, setTruncated] = useState(false);
  const msgRef = useRef<HTMLParagraphElement>(null);

  // Detect whether the clamped message actually overflows, to toggle "Read full review".
  useEffect(() => {
    const measure = () => {
      const el = msgRef.current;
      if (el) setTruncated(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [review.Message]);

  // Lock scroll while any overlay (zoom or modal) is open.
  useEffect(() => {
    if (!zoom && !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setZoom(null); setOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [zoom, open]);

  return (
    <div className="group relative h-full flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:bg-white/[0.07]">
      {/* Brand logo watermark */}
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" aria-hidden className="pointer-events-none select-none absolute -right-8 -bottom-8 w-44 opacity-[0.06] grayscale" />
      )}

      <Quote className="relative w-8 h-8 text-primary/80 mb-3 shrink-0" fill="currentColor" />

      <p ref={msgRef} className="relative text-white/85 leading-relaxed line-clamp-5">
        {review.Message}
      </p>

      {truncated && (
        <button onClick={() => setOpen(true)} className="relative self-start mt-2 text-sm font-semibold text-primary hover:underline">
          Read full review
        </button>
      )}

      {review.Images.length > 0 && (
        <div className="relative flex flex-wrap gap-2 mt-4">
          {review.Images.map((url) => (
            <button key={url} type="button" onClick={() => setZoom(url)} className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:opacity-90">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Reviewer footer — pinned to the bottom so all cards line up */}
      <div className="relative mt-auto pt-5 border-t border-white/10 flex items-center gap-3">
        <Avatar review={review} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white truncate">{review.CustomerName}</p>
          <div className="flex items-center gap-2">
            <ReviewStars value={review.Rating} size="sm" />
            {showProduct && review.ProductSlug && review.ProductName && (
              <Link href={`/product/${review.ProductSlug}`} className="text-xs text-white/40 hover:text-primary truncate">
                · {review.ProductName}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Full review modal */}
      {open && (
        <div className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 p-6 text-white" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="absolute top-4 right-4 text-white/60 hover:text-white">
              <X className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <Avatar review={review} />
              <div className="min-w-0">
                <p className="font-semibold text-white">{review.CustomerName}</p>
                <ReviewStars value={review.Rating} size="sm" />
              </div>
            </div>
            <p className="text-white/85 leading-relaxed whitespace-pre-line">{review.Message}</p>
            {review.Images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {review.Images.map((url) => (
                  <button key={url} type="button" onClick={() => setZoom(url)} className="w-20 h-20 rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:opacity-90">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {showProduct && review.ProductSlug && review.ProductName && (
              <Link href={`/product/${review.ProductSlug}`} className="inline-block mt-4 text-sm text-primary hover:underline">
                View {review.ProductName} →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Image zoom */}
      {zoom && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoom(null)} role="dialog" aria-modal="true">
          <button type="button" onClick={() => setZoom(null)} aria-label="Close" className="absolute top-4 right-4 p-2 text-white/80 hover:text-white">
            <X className="w-7 h-7" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" onClick={(e) => e.stopPropagation()} className="max-w-[92vw] max-h-[90vh] object-contain" />
        </div>
      )}
    </div>
  );
}
