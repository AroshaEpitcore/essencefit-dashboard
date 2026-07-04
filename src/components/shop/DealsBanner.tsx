import Link from "next/link";
import type { StoreProduct } from "@/lib/storefront";
import { money, discountPct } from "./format";

/* Home page deals band — replaces the third ProductSlider to break up the
   stack of sliders: a full-width black section with sales copy + CTA on the
   left and a swipeable row of dark deal cards (discount badge, old/new
   price) on the right. Renders nothing when there are no deals. */
export default function DealsBanner({ deals }: { deals: StoreProduct[] }) {
  if (!deals.length) return null;

  const maxPct = Math.max(...deals.map((p) => discountPct(p.SellingPrice, p.CompareAtPrice)));

  return (
    <section className="bg-black">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-14 grid gap-10 lg:grid-cols-[minmax(280px,1fr)_2.5fr] lg:items-center">
        {/* Left: copy */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary mb-2">Limited time</p>
          <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-wide text-white inline-block border-b-2 border-primary pb-1">
            Deals &amp; Offers
          </h2>
          <p className="mt-5 text-white/70 leading-relaxed max-w-sm">
            Premium fits, cut prices. {maxPct > 0 ? `Save up to ${maxPct}% ` : "Save "}
            on selected styles — while stock lasts.
          </p>
          <p className="mt-2 text-sm text-white/40">
            {deals.length} product{deals.length !== 1 ? "s" : ""} on sale right now
          </p>
          <Link
            href="/deals"
            className="mt-6 inline-block rounded-lg bg-primary text-white font-semibold px-6 py-3 hover:bg-primary/90 transition-colors"
          >
            Shop all deals
          </Link>
        </div>

        {/* Right: swipeable deal cards (dark) */}
        <div className="flex gap-4 overflow-x-auto snap-x pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {deals.map((p) => {
            const pct = discountPct(p.SellingPrice, p.CompareAtPrice);
            return (
              <Link
                key={p.Id}
                href={`/product/${p.Slug}`}
                className="group w-[180px] sm:w-[220px] shrink-0 snap-start"
              >
                <div className="relative aspect-[4/5] rounded-lg overflow-hidden bg-white/5">
                  {p.ImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.ImageUrl}
                      alt={p.Name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-sm">No image</div>
                  )}
                  {pct > 0 && (
                    <span className="absolute top-2 left-2 rounded-full bg-primary text-white text-[11px] font-bold px-2 py-1">
                      -{pct}%
                    </span>
                  )}
                </div>
                <p className="mt-2.5 text-sm font-semibold text-white truncate group-hover:text-primary transition-colors">{p.Name}</p>
                <div className="mt-0.5 flex items-baseline gap-2">
                  {pct > 0 && <span className="text-sm text-white/40 line-through">{money(p.CompareAtPrice)}</span>}
                  <span className="text-sm font-bold text-white">{money(p.SellingPrice)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
