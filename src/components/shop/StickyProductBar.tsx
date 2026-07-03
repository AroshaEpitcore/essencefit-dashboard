"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { money, discountPct } from "./format";

/* A full-width product summary that slides in from under the fixed navbar once
   the shopper scrolls past the main product section, and slides back up (hides)
   when they scroll back into it. Visibility is position-based off a sentinel
   placed at the end of the product section, so both directions feel natural. */
export default function StickyProductBar({
  name,
  category,
  image,
  price,
  compareAtPrice,
  sentinelRef,
  onAddToCart,
}: {
  name: string;
  category?: string | null;
  image?: string | null;
  price: number;
  compareAtPrice?: number | null;
  sentinelRef: React.RefObject<HTMLElement | null>;
  onAddToCart?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [headerH, setHeaderH] = useState(132);

  // Measure the real fixed-header height so the bar tucks exactly under it
  // (accurate across mobile / desktop and the optional promo strip).
  useEffect(() => {
    const measure = () => {
      const header = document.querySelector("header");
      if (header) setHeaderH(header.getBoundingClientRect().height);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const onScroll = () => {
      // Show once the end of the product section has scrolled above the navbar.
      setVisible(el.getBoundingClientRect().top <= headerH);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sentinelRef, headerH]);

  const pct = discountPct(price, compareAtPrice ?? null);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: "-100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed left-0 right-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 shadow-md"
          style={{ top: headerH }}
        >
          <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3 sm:gap-4">
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt={name}
                className="h-12 w-12 sm:h-14 sm:w-14 rounded object-cover border border-gray-100 shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              {category && (
                <p className="hidden sm:block text-[11px] uppercase tracking-wide text-gray-400">{category}</p>
              )}
              <p className="font-semibold text-gray-900 truncate text-sm sm:text-base">{name}</p>
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-gray-900 text-sm sm:text-base">{money(price)}</span>
                {pct > 0 && <span className="text-xs text-gray-400 line-through">{money(compareAtPrice)}</span>}
              </div>
            </div>
            <button
              onClick={onAddToCart}
              className="shrink-0 bg-gray-900 text-white px-4 sm:px-6 py-2.5 text-sm font-semibold rounded-lg flex items-center gap-2 hover:bg-gray-800 transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">Add to cart</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
