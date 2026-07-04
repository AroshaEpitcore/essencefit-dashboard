import type { Metadata } from "next";
import Link from "next/link";
import { getFeedbackItems } from "@/lib/storefront";
import FeedbackWall from "@/components/shop/FeedbackWall";
import GalleryBand from "@/components/shop/GalleryBand";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export const metadata: Metadata = {
  title: "Customer Feedback",
  description:
    "Real feedback from real customers — screenshots of what they told us about their orders, straight from the chat.",
  alternates: { canonical: "/feedback" },
};

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  // Cap the user-controllable limit so a crafted ?show= can't force an
  // unbounded LIMIT (same guard as /gallery).
  const show = Math.min(120, Math.max(PAGE_SIZE, Number(sp.show) || PAGE_SIZE));

  const { items, total } = await getFeedbackItems({ limit: show });

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Customer Feedback</h1>
      <p className="text-sm text-gray-500 mb-8">
        Straight from our customers&apos; chats — unedited screenshots of what they told us.
      </p>

      {items.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">No feedback published yet — check back soon.</p>
        </div>
      ) : (
        <>
          <FeedbackWall items={items} variant="wall" />

          {items.length < total && (
            <div className="mt-10 text-center">
              <Link
                href={`/feedback?show=${show + PAGE_SIZE}`}
                scroll={false}
                className="inline-block rounded-lg border border-gray-900 text-gray-900 font-semibold px-6 py-3 hover:bg-gray-900 hover:text-white transition-colors"
              >
                Load more ({total - items.length} remaining)
              </Link>
            </div>
          )}
        </>
      )}

      <GalleryBand />
    </div>
  );
}
