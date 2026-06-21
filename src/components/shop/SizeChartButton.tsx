"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Ruler, X } from "lucide-react";

/* "Size chart" link on the product page → opens the uploaded chart image in a
   modal. Renders nothing when the product has no chart. The modal is portalled
   to <body> so the sticky info column's stacking context can't trap it under
   the fixed navbar. */
export default function SizeChartButton({ url }: { url: string | null }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  if (!url) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 underline underline-offset-4 hover:text-primary"
      >
        <Ruler className="w-4 h-4" /> Size chart
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"
          >
            <X className="w-7 h-7" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Size chart"
            onClick={(e) => e.stopPropagation()}
            className="max-w-[92vw] max-h-[88vh] object-contain bg-white"
          />
        </div>,
        document.body
      )}
    </>
  );
}
