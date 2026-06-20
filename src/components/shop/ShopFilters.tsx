"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";

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

  const select = "w-full bg-white border border-gray-300  px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 font-semibold text-gray-900">
        <SlidersHorizontal className="w-4 h-4" /> Filters
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
        <select className={select} value={sp.get("category") || ""} onChange={(e) => update("category", e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.Slug} value={c.Slug}>{c.Name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Size</label>
        <select className={select} value={sp.get("size") || ""} onChange={(e) => update("size", e.target.value)}>
          <option value="">Any size</option>
          {sizes.map((s) => <option key={s.Id} value={s.Id}>{s.Name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Color</label>
        <select className={select} value={sp.get("color") || ""} onChange={(e) => update("color", e.target.value)}>
          <option value="">Any color</option>
          {colors.map((c) => <option key={c.Id} value={c.Id}>{c.Name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Min Rs.</label>
          <input type="number" className={select} defaultValue={sp.get("min") || ""} onBlur={(e) => update("min", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Max Rs.</label>
          <input type="number" className={select} defaultValue={sp.get("max") || ""} onBlur={(e) => update("max", e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Sort by</label>
        <select className={select} value={sp.get("sort") || ""} onChange={(e) => update("sort", e.target.value)}>
          <option value="">Featured</option>
          <option value="new">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="deals">Best deals</option>
        </select>
      </div>

      <button onClick={() => router.push("/shop")} className="text-sm text-primary font-medium hover:underline">
        Clear filters
      </button>
    </div>
  );
}
