"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setZoom(null); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [zoom]);

  return (
    <div className="group relative h-full flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:bg-white/[0.07]">
      {/* Brand logo watermark */}
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          aria-hidden
          className="pointer-events-none select-none absolute -right-8 -bottom-8 w-44 opacity-[0.06] grayscale"
        />
      )}

      {/* Quote accent */}
      <Quote className="relative w-8 h-8 text-primary/80 mb-3 shrink-0" fill="currentColor" />

      <p className="relative text-white/85 leading-relaxed flex-1">{review.Message}</p>

      {review.Images.length > 0 && (
        <div className="relative flex flex-wrap gap-2 mt-4">
          {review.Images.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => setZoom(url)}
              className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:opacity-90"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Reviewer footer */}
      <div className="relative mt-5 pt-5 border-t border-white/10 flex items-center gap-3">
        <div className="w-11 h-11 rounded-full overflow-hidden bg-primary/20 text-primary flex items-center justify-center font-semibold shrink-0 ring-1 ring-white/10">
          {review.CustomerImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={review.CustomerImage} alt={review.CustomerName} className="w-full h-full object-cover" />
          ) : (
            initials(review.CustomerName)
          )}
        </div>
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
