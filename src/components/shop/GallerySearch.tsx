"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

/* Live customer-name search for /gallery: updates the URL (server-filtered)
   as you type, debounced — no Enter needed. Clearing the input resets the
   list. The `show` load-more param is dropped on a new search. */
export default function GallerySearch({ initialQ }: { initialQ: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const term = q.trim();
      router.replace(term ? `/gallery?q=${encodeURIComponent(term)}` : "/gallery", { scroll: false });
    }, 350);
    return () => clearTimeout(t);
  }, [q, router]);

  return (
    <div className="relative max-w-sm mb-8">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by customer name..."
        className="w-full bg-gray-100 rounded-lg pl-10 pr-10 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ("")}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
