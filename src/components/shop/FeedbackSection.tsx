import Link from "next/link";
import FeedbackWall from "./FeedbackWall";
import type { FeedbackItem } from "@/lib/storefront";

/* Home page feedback band — rounded black panel styled like the reviews and
   gallery sections: eyebrow + uppercase title with a primary underline, a
   screenshot marquee (pause on hover, click to zoom), and a "View all
   feedback" CTA to /feedback. Renders nothing when there are no items. */
export default function FeedbackSection({ items, title }: { items: FeedbackItem[]; title: string }) {
  if (!items.length) return null;

  return (
    <section className="rounded-2xl bg-black px-5 sm:px-8 py-10">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary mb-2">Real conversations</p>
        <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wide text-white inline-block border-b-2 border-primary pb-1">
          {title}
        </h2>
      </div>

      <FeedbackWall items={items} variant="marquee" />

      <div className="mt-8 text-center">
        <Link
          href="/feedback"
          className="inline-block rounded-lg bg-primary text-white font-semibold px-6 py-3 hover:bg-primary/90 transition-colors"
        >
          View all feedback
        </Link>
      </div>
    </section>
  );
}
