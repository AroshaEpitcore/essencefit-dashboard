"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import Select from "./Select";

type Opt = { Id: string; Name: string };
type Cat = { Slug: string; Name: string };

export default function ShopFilters({
  categories,
  sizes,
  colors,
}: {
  categories: Cat[];
  sizes: Opt[];
  colors: Opt[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/shop?${params.toString()}`);
  }

  const input = "w-full bg-transparent border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-gray-900 transition-colors";
  const label = "block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5";

  // The filter controls (shared by the desktop sidebar and the mobile drawer).
  const sections = (
    <div className="divide-y divide-gray-200">
      <div className="py-4">
        <label className={label}>Category</label>
        <Select
          ariaLabel="Category"
          value={sp.get("category") || ""}
          onChange={(v) => update("category", v)}
          options={[{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: c.Slug, label: c.Name }))]}
        />
      </div>

      <div className="py-4">
        <label className={label}>Size</label>
        <Select
          ariaLabel="Size"
          value={sp.get("size") || ""}
          onChange={(v) => update("size", v)}
          options={[{ value: "", label: "Any size" }, ...sizes.map((s) => ({ value: s.Id, label: s.Name }))]}
        />
      </div>

      <div className="py-4">
        <label className={label}>Color</label>
        <Select
          ariaLabel="Color"
          value={sp.get("color") || ""}
          onChange={(v) => update("color", v)}
          options={[{ value: "", label: "Any color" }, ...colors.map((c) => ({ value: c.Id, label: c.Name }))]}
        />
      </div>

      <div className="py-4 grid grid-cols-2 gap-2">
        <div>
          <label className={label}>Min Rs.</label>
          <input type="number" className={input} defaultValue={sp.get("min") || ""} onBlur={(e) => update("min", e.target.value)} />
        </div>
        <div>
          <label className={label}>Max Rs.</label>
          <input type="number" className={input} defaultValue={sp.get("max") || ""} onBlur={(e) => update("max", e.target.value)} />
        </div>
      </div>

      <div className="py-4">
        <label className={label}>Sort by</label>
        <Select
          ariaLabel="Sort by"
          value={sp.get("sort") || ""}
          onChange={(v) => update("sort", v)}
          options={[
            { value: "", label: "Featured" },
            { value: "new", label: "Newest" },
            { value: "price_asc", label: "Price: low to high" },
            { value: "price_desc", label: "Price: high to low" },
            { value: "deals", label: "Best deals" },
          ]}
        />
      </div>

      <div className="pt-4">
        <button onClick={() => router.push("/shop")} className="text-sm text-primary font-medium hover:underline">
          Clear filters
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile trigger — underlined text that opens the drawer */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 underline underline-offset-4"
      >
        <SlidersHorizontal className="w-4 h-4" /> Filter
      </button>

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <div className="flex items-center gap-2 font-semibold text-gray-900 pb-4 border-b border-gray-200">
          <SlidersHorizontal className="w-4 h-4" /> Filters
        </div>
        {sections}
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-sm bg-white shadow-xl overflow-y-auto p-5">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <span className="flex items-center gap-2 font-semibold text-gray-900">
                <SlidersHorizontal className="w-4 h-4" /> Filters
              </span>
              <button onClick={() => setOpen(false)} aria-label="Close filters" className="text-gray-500 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            {sections}
            <button
              onClick={() => setOpen(false)}
              className="mt-5 w-full bg-gray-900 text-white text-sm font-semibold py-2.5 hover:bg-gray-800 transition-colors"
            >
              View results
            </button>
          </div>
        </div>
      )}
    </>
  );
}
