"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X, Loader2, ExternalLink, Sparkles } from "lucide-react";
import type { DesignIdea } from "@/lib/designIdeas";

export default function DesignsBrowser({
  initial,
  initialHasMore,
  topics,
}: {
  initial: DesignIdea[];
  initialHasMore: boolean;
  topics: string[];
}) {
  const [items, setItems] = useState<DesignIdea[]>(initial);
  const [query, setQuery] = useState(""); // "" = default feed
  const [input, setInput] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<DesignIdea | null>(null);

  const seen = useRef<Set<string>>(new Set(initial.map((d) => d.id)));
  const sentinel = useRef<HTMLDivElement | null>(null);

  // Fetch a page for the current query. reset=true replaces the grid (new search).
  const fetchPage = useCallback(
    async (q: string, nextPage: number, reset: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(nextPage) });
        if (q) params.set("q", q);
        const res = await fetch(`/api/designs?${params.toString()}`);
        const data = await res.json();
        const incoming: DesignIdea[] = data.results || [];
        if (reset) {
          seen.current = new Set(incoming.map((d) => d.id));
          setItems(incoming);
        } else {
          const fresh = incoming.filter((d) => !seen.current.has(d.id));
          fresh.forEach((d) => seen.current.add(d.id));
          setItems((prev) => [...prev, ...fresh]);
        }
        setHasMore(!!data.hasMore);
        setPage(nextPage);
      } catch {
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  function runSearch(q: string) {
    const term = q.trim();
    setInput(term);
    setQuery(term);
    fetchPage(term, 1, true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearSearch() {
    setInput("");
    setQuery("");
    seen.current = new Set(initial.map((d) => d.id));
    setItems(initial);
    setHasMore(initialHasMore);
    setPage(1);
  }

  // Infinite scroll: load the next page when the sentinel enters view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) fetchPage(query, page + 1, false);
      },
      { rootMargin: "600px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, page, query, fetchPage]);

  // Close the lightbox on Escape.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <div>
      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(input);
        }}
        className="relative max-w-2xl mx-auto"
      >
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search print designs — logos, typography, anime, floral…"
          className="w-full bg-gray-100 rounded-full pl-12 pr-11 py-3.5 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {input && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900"
            aria-label="Clear"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </form>

      {/* Topic chips */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {topics.map((t) => {
          const on = query.toLowerCase() === t.toLowerCase();
          return (
            <button
              key={t}
              type="button"
              onClick={() => runSearch(t)}
              className={`px-3.5 py-1.5 rounded-full text-sm capitalize transition-colors border ${
                on
                  ? "bg-gray-900 text-white border-gray-900"
                  : "border-gray-300 text-gray-700 hover:border-gray-900 hover:text-gray-900"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      <p className="mt-6 mb-4 text-sm text-gray-500 text-center">
        {query ? (
          <>
            Showing print-design ideas for <span className="font-semibold text-gray-800">“{query}”</span>
          </>
        ) : (
          "Fresh print-design inspiration — tap any design, then start your own custom print."
        )}
      </p>

      {/* Masonry grid */}
      {items.length === 0 && !loading ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">No designs found{query ? ` for “${query}”` : ""}.</p>
          <button onClick={clearSearch} className="mt-2 text-sm font-semibold text-primary hover:underline">
            Reset
          </button>
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-4">
          {items.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setActive(d)}
              className="group mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={d.thumb}
                alt={d.title}
                loading="lazy"
                decoding="async"
                className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </button>
          ))}
        </div>
      )}

      {/* Loading / sentinel */}
      <div ref={sentinel} className="h-10" />
      {loading && (
        <div className="flex justify-center py-6 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {/* Lightbox (view-only) */}
      {active && (
        <div
          className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-gray-100 flex-1 min-h-0 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={active.full} alt={active.title} className="max-h-[60vh] w-auto object-contain" />
              <button
                onClick={() => setActive(null)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <h3 className="font-semibold text-gray-900 line-clamp-2">{active.title}</h3>
              <p className="mt-1 text-xs text-gray-500">
                {active.creator ? `By ${active.creator}` : "Openly licensed"}
                {active.license ? ` · ${active.license}` : ""}
                {active.licenseUrl && (
                  <>
                    {" "}
                    <a
                      href={active.licenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-gray-700"
                    >
                      license
                    </a>
                  </>
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/customize"
                  className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-5 py-2.5 rounded-lg text-sm"
                >
                  <Sparkles className="w-4 h-4" /> Get a design like this printed
                </Link>
                {active.source && (
                  <a
                    href={active.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 hover:border-gray-900 hover:text-gray-900 px-5 py-2.5 rounded-lg text-sm"
                  >
                    <ExternalLink className="w-4 h-4" /> View source
                  </a>
                )}
              </div>
              <p className="mt-3 text-[11px] text-gray-400">
                Inspiration only — we’ll create original artwork for your print. Send us your idea on the customize page.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
