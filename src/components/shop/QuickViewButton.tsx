"use client";

import { Eye } from "lucide-react";
import { useQuickView } from "./QuickView";

export default function QuickViewButton({ productId }: { productId: string }) {
  const { open } = useQuickView();
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        open(productId);
      }}
      className="absolute bottom-0 inset-x-0 z-10 bg-black/75 text-white text-xs font-semibold tracking-wide py-2 flex items-center justify-center gap-1.5 translate-y-full group-hover:translate-y-0 transition-transform duration-200"
    >
      <Eye className="w-4 h-4" /> QUICK VIEW
    </button>
  );
}
