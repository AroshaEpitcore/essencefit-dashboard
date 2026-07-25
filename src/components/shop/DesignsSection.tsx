import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { DesignIdea } from "@/lib/designIdeas";

/* Home-page teaser for the /designs browse page: a compact masonry preview of
   auto-fetched print-design ideas with a CTA to explore the full, searchable grid. */
export default function DesignsSection({ items }: { items: DesignIdea[] }) {
  if (!items.length) return null;
  const preview = items.slice(0, 10);

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-14">
      <div className="rounded-3xl bg-gray-900 text-white overflow-hidden">
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-8 items-center p-8 sm:p-12">
          {/* Copy */}
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              <Sparkles className="w-4 h-4" /> Design ideas
            </p>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold leading-tight">
              Need a design for your print?
            </h2>
            <p className="mt-4 text-white/70 leading-relaxed">
              Browse thousands of print-design ideas, search any style you love, then get your
              favourite printed on premium apparel — made in Sri Lanka.
            </p>
            <Link
              href="/designs"
              className="mt-7 inline-flex items-center gap-2 bg-white text-gray-900 font-semibold px-6 py-3 rounded-lg hover:bg-white/90 transition-colors"
            >
              Explore print designs <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Masonry preview */}
          <Link href="/designs" className="block">
            <div className="columns-3 sm:columns-4 lg:columns-5 gap-3">
              {preview.map((d) => (
                <div key={d.id} className="mb-3 break-inside-avoid overflow-hidden rounded-lg bg-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.thumb}
                    alt={d.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-auto object-cover transition-transform duration-300 hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
