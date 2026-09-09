"use client";

import { useMemo, useState } from "react";
import { Star, PencilLine } from "lucide-react";
import ReviewStars from "./ReviewStars";
import ReviewForm from "./ReviewForm";
import GalleryLightbox from "./GalleryLightbox";
import type { StoreReview } from "@/lib/storefront";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/* Standard e-commerce "Ratings & Reviews" block for the PDP: a summary
   (average + star histogram), a "Write a review" call-to-action that opens the
   public submission form, and the list of this product's published reviews.
   Always renders so the write-review CTA is available even with zero reviews. */
export default function ProductReviews({
  productId,
  avg,
  count,
  reviews,
}: {
  productId: string;
  avg: number;
  count: number;
  reviews: StoreReview[];
}) {
  const [open, setOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  // Histogram from the displayed (published) reviews — 5★ … 1★.
  const histogram = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    for (const r of reviews) {
      const i = Math.min(5, Math.max(1, Math.round(r.Rating))) - 1;
      buckets[i]++;
    }
    return buckets;
  }, [reviews]);

  const shown = reviews.length;

  return (
    <section id="reviews" className="mt-14 scroll-mt-[140px]">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Ratings &amp; Reviews</h2>

      <div className="grid gap-8 md:grid-cols-[minmax(0,280px)_1fr]">
        {/* Summary + CTA */}
        <div>
          {count > 0 ? (
            <div className="flex items-start gap-5">
              <div className="text-center shrink-0">
                <div className="text-4xl font-bold text-gray-900 leading-none">{avg.toFixed(1)}</div>
                <ReviewStars value={avg} className="mt-2 justify-center" />
                <div className="text-xs text-gray-500 mt-1.5">{count} review{count !== 1 ? "s" : ""}</div>
              </div>
              <div className="flex-1 min-w-0 space-y-1.5 pt-1">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const c = histogram[stars - 1];
                  const pct = shown ? (c / shown) * 100 : 0;
                  return (
                    <div key={stars} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="flex items-center gap-0.5 w-8 shrink-0">
                        {stars}
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      </span>
                      <span className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                        <span className="block h-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-5 text-right tabular-nums">{c}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No reviews yet — be the first to review this product.</p>
          )}

          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-gray-900 text-gray-900 font-semibold px-5 py-2.5 hover:bg-gray-900 hover:text-white transition-colors"
            >
              <PencilLine className="w-4 h-4" />
              Write a review
            </button>
          )}
        </div>

        {/* Form + list */}
        <div>
          {open && (
            <div className="mb-8">
              <ReviewForm productId={productId} onCancel={() => setOpen(false)} />
            </div>
          )}

          {reviews.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {reviews.map((r) => (
                <li key={r.Id} className="py-5 first:pt-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                      {r.CustomerImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.CustomerImage} alt={r.CustomerName} className="w-full h-full object-cover" />
                      ) : (
                        initials(r.CustomerName)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{r.CustomerName}</p>
                      <div className="flex items-center gap-2">
                        <ReviewStars value={r.Rating} size="sm" />
                        <span className="text-xs text-gray-400">{timeAgo(r.CreatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{r.Message}</p>
                  {r.Images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {r.Images.map((url, i) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setLightbox({ images: r.Images, index: i })}
                          className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 hover:opacity-90"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Photo from ${r.CustomerName}'s review`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            !open && <p className="text-sm text-gray-400">Reviews from verified customers will show here.</p>
          )}
        </div>
      </div>

      {lightbox && (
        <GalleryLightbox images={lightbox.images} startIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}
    </section>
  );
}
