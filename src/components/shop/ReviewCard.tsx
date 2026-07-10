"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReviewStars from "./ReviewStars";
import GalleryLightbox from "./GalleryLightbox";
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
  const [lightbox, setLightbox] = useState<number | null>(null);
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
          {review.Images.map((url, i) => (
            <button key={url} type="button" onClick={() => setLightbox(i)} className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:opacity-90">
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

      {lightbox !== null && (
        <GalleryLightbox
          images={review.Images}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
