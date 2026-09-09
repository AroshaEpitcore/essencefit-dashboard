"use client";

import { useMemo, useState } from "react";
import { Star, PencilLine, BadgeCheck, MessageSquareText } from "lucide-react";
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

// Stable per-name colour so avatars aren't all the same flat swatch.
const AVATAR_TINTS = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-orange-100 text-orange-700",
];
function tint(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/* Standard e-commerce "Ratings & Reviews" block for the PDP: a summary card
   (average + star histogram + CTA), a public "Write a review" form, and the
   list of this product's published reviews. Always renders so the write-review
   CTA is available even with zero reviews. */
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
    <section id="reviews" className="mt-16 scroll-mt-[140px]">
      <div className="flex items-end justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Ratings &amp; Reviews</h2>
        {count > 0 && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-sm text-gray-500">
            <MessageSquareText className="w-4 h-4" />
            {count} verified review{count !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:gap-10 lg:grid-cols-[320px_1fr]">
        {/* ---------- Summary card ---------- */}
        <div className="lg:sticky lg:top-24 self-start">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-card">
            {count > 0 ? (
              <>
                <div className="flex items-center gap-4">
                  <div className="leading-none">
                    <span className="text-5xl font-extrabold text-gray-900">{avg.toFixed(1)}</span>
                    <span className="text-lg font-medium text-gray-400">/5</span>
                  </div>
                  <div className="pt-1">
                    <ReviewStars value={avg} size="lg" />
                    <p className="text-xs text-gray-500 mt-1.5">Based on {count} review{count !== 1 ? "s" : ""}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const c = histogram[stars - 1];
                    const pct = shown ? (c / shown) * 100 : 0;
                    return (
                      <div key={stars} className="flex items-center gap-2.5 text-xs">
                        <span className="flex items-center gap-1 w-9 shrink-0 text-gray-600 font-medium">
                          {stars}
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        </span>
                        <span className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <span
                            className="block h-full rounded-full bg-amber-400 transition-[width] duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="w-6 text-right tabular-nums text-gray-400">{c}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-3">
                  <Star className="w-6 h-6 text-amber-400" />
                </div>
                <p className="font-semibold text-gray-900">No reviews yet</p>
                <p className="text-sm text-gray-500 mt-1">Be the first to review this product.</p>
              </div>
            )}

            {!open && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 text-white font-semibold px-5 py-3 hover:bg-black transition-colors"
              >
                <PencilLine className="w-4 h-4" />
                Write a review
              </button>
            )}
          </div>
        </div>

        {/* ---------- Form + list ---------- */}
        <div className="min-w-0">
          {open && (
            <div className="mb-8">
              <ReviewForm productId={productId} onCancel={() => setOpen(false)} />
            </div>
          )}

          {reviews.length > 0 ? (
            <ul className="space-y-4">
              {reviews.map((r) => (
                <li key={r.Id} className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
                  <div className="flex items-start gap-3.5">
                    <div className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-semibold text-sm shrink-0 ${tint(r.CustomerName)}`}>
                      {r.CustomerImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.CustomerImage} alt={r.CustomerName} className="w-full h-full object-cover" />
                      ) : (
                        initials(r.CustomerName)
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="font-semibold text-gray-900">{r.CustomerName}</p>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                          <BadgeCheck className="w-3.5 h-3.5" />
                          Verified
                        </span>
                        <span className="text-xs text-gray-400 ml-auto shrink-0">{fmtDate(r.CreatedAt)}</span>
                      </div>

                      <ReviewStars value={r.Rating} size="sm" className="mt-1" />

                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line mt-2.5">{r.Message}</p>

                      {r.Images.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {r.Images.map((url, i) => (
                            <button
                              key={url}
                              type="button"
                              onClick={() => setLightbox({ images: r.Images, index: i })}
                              className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 hover:opacity-90 transition-opacity"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={`Photo from ${r.CustomerName}'s review`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            !open && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 py-14 px-6 text-center">
                <MessageSquareText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="font-semibold text-gray-700">No reviews for this product yet</p>
                <p className="text-sm text-gray-500 mt-1">Bought this? Share your experience to help other shoppers.</p>
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg border border-gray-900 text-gray-900 font-semibold px-5 py-2.5 hover:bg-gray-900 hover:text-white transition-colors"
                >
                  <PencilLine className="w-4 h-4" />
                  Write the first review
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {lightbox && (
        <GalleryLightbox images={lightbox.images} startIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}
    </section>
  );
}
