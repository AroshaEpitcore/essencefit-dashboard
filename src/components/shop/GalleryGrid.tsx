"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GalleryCard from "./GalleryCard";
import { loadMoreGalleryItems } from "@/app/(shop)/gallery/actions";
import type { GalleryItem } from "@/lib/storefront";

/* Infinite-scroll grid for /gallery. Renders the server-provided first page,
   then auto-loads the next page via a server action when a sentinel near the
   bottom scrolls into view — no "Load more" button. Search resets the list by
   remounting this component (keyed on `q` by the page). */
export default function GalleryGrid({
  initialItems,
  total,
  q,
  autoOpenId,
}: {
  initialItems: GalleryItem[];
  total: number;
  q?: string;
  autoOpenId?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initialItems.length >= total);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Guards against firing a second fetch before the first resolves.
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || done) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const { items: next, total: t } = await loadMoreGalleryItems(q, items.length);
      setItems((prev) => {
        const merged = [...prev, ...next];
        if (merged.length >= t || next.length === 0) setDone(true);
        return merged;
      });
    } catch {
      // Leave the sentinel in place; a later scroll will retry.
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [q, items.length, done]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || done) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, done]);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
        {items.map((item) => (
          <GalleryCard key={item.Id} item={item} shareable autoOpen={autoOpenId === item.Id} />
        ))}
      </div>

      {!done && (
        <div ref={sentinelRef} className="mt-10 flex justify-center py-6" aria-hidden>
          {loading && (
            <span className="inline-block w-6 h-6 rounded-full border-2 border-gray-300 border-t-gray-900 animate-spin" />
          )}
        </div>
      )}
    </>
  );
}
