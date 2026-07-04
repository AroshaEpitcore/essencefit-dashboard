import Link from "next/link";
import GalleryCard from "./GalleryCard";
import AutoScroller from "./AutoScroller";
import type { GalleryItem } from "@/lib/storefront";

/* Home page "Custom Orders" band — rounded black panel styled like the
   reviews section: uppercase heading with a primary underline, a continuous
   marquee of gallery cards (duplicated track, paused on hover — same idiom
   as the reviews carousel), and a "View the full gallery" CTA to /gallery.
   Renders nothing when there are no published items. */
export default function GallerySection({ items, title }: { items: GalleryItem[]; title: string }) {
  if (!items.length) return null;

  return (
    <section className="rounded-2xl bg-black px-5 sm:px-8 py-10">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary mb-2">Custom orders</p>
        <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wide text-white inline-block border-b-2 border-primary pb-1">
          {title}
        </h2>
      </div>

      {/* Continuous flow — native-scroll auto-slider (duplicated track wraps
          at the halfway point); pauses on hover/touch, swipeable by hand. */}
      <div className="-mx-1">
        <AutoScroller>
          {[...items, ...items].map((item, i) => (
            <div key={`${item.Id}-${i}`} className="w-[240px] sm:w-[280px] shrink-0 px-1.5">
              <GalleryCard item={item} onDark />
            </div>
          ))}
        </AutoScroller>
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/gallery"
          className="inline-block rounded-lg bg-primary text-white font-semibold px-6 py-3 hover:bg-primary/90 transition-colors"
        >
          View the full gallery
        </Link>
      </div>
    </section>
  );
}
