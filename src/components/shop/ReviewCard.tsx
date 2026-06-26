"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import ReviewStars from "./ReviewStars";
import type { StoreReview } from "@/lib/storefront";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ReviewCard({ review, showProduct = false }: { review: StoreReview; showProduct?: boolean }) {
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
    <div className="bg-white border border-gray-200 rounded-xl p-5 h-full flex flex-col">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full overflow-hidden bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
          {review.CustomerImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={review.CustomerImage} alt={review.CustomerName} className="w-full h-full object-cover" />
          ) : (
            initials(review.CustomerName)
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{review.CustomerName}</p>
          <ReviewStars value={review.Rating} size="sm" />
        </div>
      </div>

      <p className="text-gray-600 leading-relaxed mt-3 flex-1">{review.Message}</p>

      {review.Images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {review.Images.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => setZoom(url)}
              className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-100 hover:opacity-90"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {showProduct && review.ProductSlug && review.ProductName && (
        <Link href={`/product/${review.ProductSlug}`} className="text-xs text-gray-400 hover:text-primary mt-3">
          on {review.ProductName}
        </Link>
      )}

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
