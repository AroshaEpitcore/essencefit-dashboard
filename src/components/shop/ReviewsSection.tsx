"use client";

import ReviewCard from "./ReviewCard";
import type { StoreReview } from "@/lib/storefront";

/* Storefront reviews band on black. The "carousel" variant flows continuously
   like a marquee (duplicated track, paused on hover); the "grid" variant is a
   simple responsive grid. Renders nothing when there are no reviews. */
export default function ReviewsSection({
  reviews,
  title,
  variant = "grid",
  showProduct = false,
  bare = false,
  logo = null,
}: {
  reviews: StoreReview[];
  title: string;
  variant?: "grid" | "carousel";
  showProduct?: boolean;
  bare?: boolean;
  logo?: string | null;
}) {
  if (!reviews.length) return null;

  const header = (
    <div className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary mb-2">Real customers</p>
      <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wide text-white inline-block border-b-2 border-primary pb-1">
        {title}
      </h2>
    </div>
  );

  const body =
    variant === "carousel" ? (
      // Continuous flow — duplicate the cards and translate -50% so it loops seamlessly.
      <div className="marquee-pause overflow-hidden -mx-1">
        <div
          className="flex w-max animate-marquee"
          style={{ animationDuration: `${Math.max(reviews.length, 4) * 10}s` }}
        >
          {[...reviews, ...reviews].map((r, i) => (
            <div key={`${r.Id}-${i}`} className="w-[320px] sm:w-[420px] shrink-0 px-1.5">
              <ReviewCard review={r} showProduct={showProduct} logo={logo} />
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reviews.map((r) => (
          <ReviewCard key={r.Id} review={r} showProduct={showProduct} logo={logo} />
        ))}
      </div>
    );

  const inner = (
    <>
      {header}
      {body}
    </>
  );

  if (bare) {
    return <section className="rounded-2xl bg-black px-5 sm:px-8 py-10">{inner}</section>;
  }

  return (
    <section className="bg-black">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-16">{inner}</div>
    </section>
  );
}
