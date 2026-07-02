"use client";

import { useEffect, useRef, useState } from "react";
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
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const msgRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = msgRef.current;
    if (!el || expanded) return;
    const measure = () => setTruncated(el.scrollHeight > el.clientHeight + 1);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [review.Message, expanded]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setZoom(null); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [zoom]);

  return (
    <div className="relative overflow-hidden h-full flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      {/* Brand logo watermark */}
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" aria-hidden className="pointer-events-none select-none absolute -right-6 -bottom-6 w-36 opacity-[0.07]" />
      )}

      {/* Reviewer header */}
      <div className="relative flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-full overflow-hidden bg-primary/20 text-primary flex items-center justify-center font-semibold shrink-0 ring-1 ring-white/10">
          {review.CustomerImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={review.CustomerImage} alt={review.CustomerName} className="w-full h-full object-cover" />
          ) : (
            initials(review.CustomerName)
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white truncate">{review.CustomerName}</p>
          <ReviewStars value={review.Rating} size="sm" />
        </div>
      </div>

      {/* Message with inline expand */}
      <p ref={msgRef} className={`relative text-white/80 leading-relaxed ${expanded ? "" : "line-clamp-5"}`}>
        {review.Message}
      </p>
      {truncated && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="relative self-start mt-2 text-sm font-semibold text-primary hover:underline"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}

      {review.Images.length > 0 && (
        <div className="relative flex flex-wrap gap-2 mt-4">
          {review.Images.map((url) => (
            <button key={url} type="button" onClick={() => setZoom(url)} className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:opacity-90">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Photo from ${review.CustomerName}'s review`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {showProduct && review.ProductSlug && review.ProductName && (
        <Link href={`/product/${review.ProductSlug}`} className="relative mt-4 text-xs text-white/40 hover:text-primary">
          on {review.ProductName}
        </Link>
      )}

      {zoom && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoom(null)} role="dialog" aria-modal="true">
          <button type="button" onClick={() => setZoom(null)} aria-label="Close" className="absolute top-4 right-4 p-2 text-white/80 hover:text-white">
            <X className="w-7 h-7" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt={`Photo from ${review.CustomerName}'s review`} onClick={(e) => e.stopPropagation()} className="max-w-[92vw] max-h-[90vh] object-contain" />
        </div>
      )}
    </div>
  );
}
