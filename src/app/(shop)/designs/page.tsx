import type { Metadata } from "next";
import { fetchDesignIdeas, DESIGN_TOPICS } from "@/lib/designIdeas";
import DesignsBrowser from "./DesignsBrowser";

export const metadata: Metadata = {
  title: "Print Design Ideas",
  description:
    "Browse thousands of print-design ideas for custom t-shirts and apparel — search by style, then get your favourite printed with EssenceFit in Sri Lanka.",
  alternates: { canonical: "/designs" },
};

// Revalidate the first paint every 10 min; the client grid fetches more on
// demand (and falls back to a client fetch if this ever renders empty).
export const revalidate = 600;

export default async function DesignsPage() {
  const feed = await fetchDesignIdeas({ page: 1 });

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Print Design Ideas</h1>
        <p className="mt-2 text-sm text-gray-500 max-w-xl mx-auto">
          Explore endless print inspiration — search any style and tap a design to start your own custom print.
        </p>
      </div>

      <DesignsBrowser
        initial={feed.results}
        initialHasMore={feed.hasMore}
        topics={DESIGN_TOPICS}
      />
    </div>
  );
}
