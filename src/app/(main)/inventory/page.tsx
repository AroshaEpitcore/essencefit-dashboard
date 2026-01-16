"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  getLookups,
  getProductsByCategory,
  getColorsByCategorySize,
  getProductQuantities,
  getAvailability,
  searchColorQuantities,
  getSizeQuantitiesByCategory,
} from "./actions";
import toast, { Toaster } from "react-hot-toast";
import {
  Clipboard,
  Package,
  Palette,
  Search,
  FileDown,
  Eye,
} from "lucide-react";

type Opt = { Id: string; Name: string; SKU?: string | null };

type ProductCard = {
  Id: string;
  Name: string;
  SKU: string | null;
  TotalQty: number;
  LowStockVariants: number;
};

export default function InventoryColorsPage() {
  const [loading, setLoading] = useState(false);

  // lookups
  const [categories, setCategories] = useState<Opt[]>([]);
  const [sizes, setSizes] = useState<Opt[]>([]);
  const [colors, setColors] = useState<Opt[]>([]);

  // cascading products for selected category
  const [products, setProducts] = useState<Opt[]>([]);

  // selections (for different sections)
  const [selCatForCards, setSelCatForCards] = useState("");
  const [selCatForColors, setSelCatForColors] = useState("");
  const [selSizeForColors, setSelSizeForColors] = useState("");

  const [selCatForAvail, setSelCatForAvail] = useState("");
  const [selProdForAvail, setSelProdForAvail] = useState("");
  const [selSizeForAvail, setSelSizeForAvail] = useState("");
  const [selColorForAvail, setSelColorForAvail] = useState("");

  // data
  // data
  const [cards, setCards] = useState<ProductCard[]>([]);
  const [colorsAvail, setColorsAvail] = useState<
    Array<{ Color: string; Qty: number }>
  >([]);
  const [sizeQtys, setSizeQtys] = useState<Array<{ Size: string; Qty: number }>>(
    []
  );
  const [availQty, setAvailQty] = useState<number | null>(null);

  // Search states
  const [searchColorInput, setSearchColorInput] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      Color: string;
      Size: string;
      Product: string;
      Category: string;
      Qty: number;
    }>
  >([]);
  const [searchDebounceTimer, setSearchDebounceTimer] =
    useState<NodeJS.Timeout | null>(null);

  // Search function
  const searchColor = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const results = await searchColorQuantities(searchTerm.trim());
      setSearchResults(results);
    } catch (e: any) {
      toast.error(e.message ?? "Search failed");
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-search effect
  useEffect(() => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    if (searchColorInput.trim()) {
      const timer = setTimeout(() => {
        searchColor(searchColorInput);
      }, 500);
      setSearchDebounceTimer(timer);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
    };
  }, [searchColorInput, searchColor]);

  // initial lookups
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getLookups();
        setCategories(data.categories);
        setSizes(data.sizes);
        setColors(data.colors);
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load lookups");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // when category changes (for cards)
  useEffect(() => {
    (async () => {
      if (!selCatForCards) {
        setCards([]);
        return;
      }
      setLoading(true);
      try {
        const list = await getProductQuantities(selCatForCards);
        setCards(list);
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load product quantities");
        setCards([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selCatForCards]);

  // when category changes (for availability picker) -> load products dropdown
  useEffect(() => {
    (async () => {
      if (!selCatForAvail) {
        setProducts([]);
        setSelProdForAvail("");
        return;
      }
      try {
        const rows = await getProductsByCategory(selCatForAvail);
        setProducts(rows);
        setSelProdForAvail("");
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load products");
      }
    })();
  }, [selCatForAvail]);

  // load size quantities when category changes
  useEffect(() => {
    (async () => {
      if (!selCatForColors) {
        setSizeQtys([]);
        return;
      }
      try {
        const rows = await getSizeQuantitiesByCategory(selCatForColors);
        setSizeQtys(rows);
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load size quantities");
        setSizeQtys([]);
      }
    })();
  }, [selCatForColors]);

  // colors by category + size
  async function showColorsByCategorySize() {
    if (!selCatForColors || !selSizeForColors) {
      toast.error("Pick Category and Size");
      return;
    }
    setLoading(true);
    try {
      const rows = await getColorsByCategorySize(
        selCatForColors,
        selSizeForColors
      );
      setColorsAvail(rows);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load colors");
      setColorsAvail([]);
    } finally {
      setLoading(false);
    }
  }

  function copyColors() {
    const available = colorsAvail.filter((r) => r.Qty > 0);
    if (!available.length) return;
    const sizeName = sizes.find((s) => s.Id === selSizeForColors)?.Name ?? "";
    const header = `${sizeName} Available colors list`;
    const colorsList = available.map((r) => r.Color).join("\n");
    const txt = `${header}\n${colorsList}`;
    navigator.clipboard
      .writeText(txt)
      .then(() => toast.success("Copied"))
      .catch(() => toast.error("Copy failed"));
  }

  function exportColorsCSV() {
    if (!colorsAvail.length) return;
    const esc = (s: unknown) => {
      const v = s == null ? "" : String(s);
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const body = colorsAvail
      .map((r) => `${esc(r.Color)},${esc(r.Qty)}`)
      .join("\n");
    const csv = `color,qty\n${body}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "colors_by_category_size.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // availability check
  async function checkAvailability() {
    if (!selProdForAvail || !selSizeForAvail || !selColorForAvail) {
      toast.error("Pick Product, Size and Color");
      return;
    }
    setLoading(true);
    try {
      const qty = await getAvailability(
        selProdForAvail,
        selSizeForAvail,
        selColorForAvail
      );
      setAvailQty(Number(qty ?? 0));
    } catch (e: any) {
      toast.error(e.message ?? "Failed to check availability");
      setAvailQty(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="!m-0 flex items-center gap-3">
        <div className="bg-primary/20 p-3 rounded-lg">
          <Package className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Inventory</h1>
      </div>

      {/* ================= Color Search ================= */}
      <section className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          Search Color Inventory
        </h2>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Type color name to search..."
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg pl-12 pr-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              value={searchColorInput}
              onChange={(e) => setSearchColorInput(e.target.value)}
            />
            {searchColorInput && (
              <button
                onClick={() => {
                  setSearchColorInput("");
                  setSearchResults([]);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            )}
          </div>
          {loading && searchColorInput && (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Searching...
            </div>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-4">
            {Object.entries(
              searchResults.reduce((acc, item) => {
                if (!acc[item.Color]) acc[item.Color] = [];
                acc[item.Color].push(item);
                return acc;
              }, {} as Record<string, typeof searchResults>)
            ).map(([color, items]) => (
              <div
                key={color}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-gray-50 dark:bg-gray-900/50"
              >
                <div className="font-semibold text-lg mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                  <Palette className="w-5 h-5 text-primary" />
                  {color}
                </div>
                <div className="space-y-3">
                  {Object.entries(
                    items.reduce((acc, item) => {
                      const key = `${item.Category} - ${item.Product}`;
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(item);
                      return acc;
                    }, {} as Record<string, typeof items>)
                  ).map(([productKey, productItems]) => (
                    <div
                      key={productKey}
                      className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                    >
                      <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        {productKey}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {productItems.map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 px-4 py-1.5 text-sm bg-gray-50 dark:bg-gray-900/50"
                          >
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {item.Size}
                            </span>
                            <span className="text-xs font-semibold text-primary">
                              {item.Qty} pcs
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {searchResults.length === 0 && searchColorInput && !loading && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Search className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No results found for "{searchColorInput}"</p>
          </div>
        )}

        {!searchColorInput && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Palette className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>Start typing a color name to search inventory</p>
          </div>
        )}
      </section>

      {/* ================= Product Quantities (by Category) ================= */}
      <section className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Product Quantities
          </h2>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {loading
              ? "Loading…"
              : cards.length
              ? `${cards.length} product(s)`
              : "—"}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Category
          </label>
          <select
            className="w-full md:w-64 bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            value={selCatForCards}
            onChange={(e) => setSelCatForCards(e.target.value)}
          >
            <option value="">-- Select Category --</option>
            {categories.map((c) => (
              <option key={c.Id} value={c.Id}>
                {c.Name}
              </option>
            ))}
          </select>
        </div>

        {!cards.length ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Pick a category to view products and quantities.</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((p) => (
              <div
                key={p.Id}
                className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 bg-gray-50 dark:bg-gray-900/50 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {p.Name}
                    </div>
                    {p.SKU && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        SKU: {p.SKU}
                      </div>
                    )}
                  </div>
                  <div className="text-xl font-bold text-primary">
                    {p.TotalQty}
                  </div>
                </div>
                {p.LowStockVariants > 0 && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                    {p.LowStockVariants} low stock
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ================= Colors by Category & Size ================= */}
      <section className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-5 items-center">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              Colors by Category & Size
            </h2>
            {sizeQtys.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sizeQtys.map((s) => (
                  <span
                    key={s.Size}
                    className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full"
                  >
                    <span className="font-medium">{s.Size}:</span>
                    <span className="text-primary font-semibold">{s.Qty}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportColorsCSV}
              className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 flex items-center gap-2 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!colorsAvail.length}
            >
              <FileDown className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              value={selCatForColors}
              onChange={(e) => setSelCatForColors(e.target.value)}
            >
              <option value="">-- Select Category --</option>
              {categories.map((c) => (
                <option key={c.Id} value={c.Id}>
                  {c.Name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Size
            </label>
            <select
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              value={selSizeForColors}
              onChange={(e) => setSelSizeForColors(e.target.value)}
            >
              <option value="">-- Select Size --</option>
              {sizes.map((s) => (
                <option key={s.Id} value={s.Id}>
                  {s.Name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={showColorsByCategorySize}
              className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors font-semibold disabled:opacity-50"
              disabled={loading}
            >
              <Eye className="w-4 h-4" />
              {loading ? "Loading…" : "Show Colors"}
            </button>
            <button
              onClick={copyColors}
              className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!colorsAvail.length}
            >
              <Clipboard className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div>
          {!colorsAvail.filter((c) => c.Qty > 0).length ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              <Palette className="w-10 h-10 mx-auto mb-2 opacity-50" />
              Pick a Category and Size, then click <b>Show Colors</b>.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {colorsAvail
                .filter((c) => c.Qty > 0)
                .map((c) => (
                  <span
                    key={c.Color}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                    title={`${c.Qty} pcs`}
                  >
                    <span className="font-medium text-gray-900 dark:text-white">
                      {c.Color}
                    </span>
                    <span className="text-xs font-semibold text-primary">
                      {c.Qty}
                    </span>
                  </span>
                ))}
            </div>
          )}
        </div>
      </section>

      {/* ================= Availability (Product + Size + Color) ================= */}
      <section className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          Check Availability
        </h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              value={selCatForAvail}
              onChange={(e) => {
                setSelCatForAvail(e.target.value);
                setAvailQty(null);
              }}
            >
              <option value="">-- Select --</option>
              {categories.map((c) => (
                <option key={c.Id} value={c.Id}>
                  {c.Name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Product
            </label>
            <select
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
              value={selProdForAvail}
              onChange={(e) => {
                setSelProdForAvail(e.target.value);
                setAvailQty(null);
              }}
              disabled={!selCatForAvail}
            >
              <option value="">-- Select --</option>
              {products.map((p) => (
                <option key={p.Id} value={p.Id}>
                  {p.Name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Color
            </label>
            <select
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
              value={selColorForAvail}
              onChange={(e) => {
                setSelColorForAvail(e.target.value);
                setAvailQty(null);
              }}
              disabled={!selProdForAvail}
            >
              <option value="">-- Select --</option>
              {colors.map((c) => (
                <option key={c.Id} value={c.Id}>
                  {c.Name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Size
            </label>
            <select
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
              value={selSizeForAvail}
              onChange={(e) => {
                setSelSizeForAvail(e.target.value);
                setAvailQty(null);
              }}
              disabled={!selProdForAvail}
            >
              <option value="">-- Select --</option>
              {sizes.map((s) => (
                <option key={s.Id} value={s.Id}>
                  {s.Name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={checkAvailability}
              className="w-full bg-primary hover:bg-primary/90 text-white rounded-lg px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              Check
            </button>
          </div>

          {availQty !== null && (
            <div className="sm:col-span-2 lg:col-span-5 mt-2">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Availability:{" "}
                </span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {availQty} pcs
                </span>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
