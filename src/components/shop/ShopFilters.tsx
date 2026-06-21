"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
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

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/shop?${params.toString()}`);
  }

  const input = "w-full bg-transparent border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-gray-900 transition-colors";
  const label = "block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5";

  return (
    <div className="divide-y divide-gray-200">
      <div className="flex items-center gap-2 font-semibold text-gray-900 pb-4">
        <SlidersHorizontal className="w-4 h-4" /> Filters
      </div>

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
}
