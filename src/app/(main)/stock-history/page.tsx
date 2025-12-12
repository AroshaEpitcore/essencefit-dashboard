"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { getLookups } from "../stocks/actions";
import { getStockHistory } from "./actions";
import { Download, Filter, Layers, PlusCircle, MinusCircle } from "lucide-react";

type History = {
  Id: string;
  CreatedAt: string;
  CategoryName: string;
  ProductName: string;
  SizeName?: string;
  ColorName?: string;
  ChangeQty: number;
  Reason: string;
  PreviousQty?: number;
  NewQty?: number;
  PriceAtChange?: number;
};

export default function StockHistoryPage() {
  const [lookups, setLookups] = useState<any>({
    categories: [],
    sizes: [],
    colors: [],
  });
  const [products, setProducts] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    categoryId: "",
    productId: "",
    sizeId: "",
    colorId: "",
    from: "",
    to: "",
  });
  const [data, setData] = useState<History[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLookups();
    loadHistory();
  }, []);

  async function loadLookups() {
    const d = await getLookups();
    setLookups(d);
  }

  async function loadHistory() {
    setLoading(true);
    try {
      const res = await getStockHistory(filters);
      setData(res);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function exportCSV() {
    const rows = [
      ["Date", "Category", "Product", "Size", "Color", "Qty", "Action", "Prev Qty", "New Qty", "Price"],
      ...data.map((r) => [
        new Date(r.CreatedAt).toLocaleString(),
        r.CategoryName,
        r.ProductName,
        r.SizeName || "-",
        r.ColorName || "-",
        r.ChangeQty,
        r.Reason,
        r.PreviousQty ?? "",
        r.NewQty ?? "",
        r.PriceAtChange ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `StockHistory-${Date.now()}.csv`;
    a.click();
  }

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-primary/20 p-3 rounded-lg">
          <Layers className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Stock History</h1>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
          <select
            value={filters.categoryId}
            onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
            className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700"
          >
            <option value="">Category</option>
            {lookups.categories.map((c: any) => (
              <option key={c.Id} value={c.Id}>
                {c.Name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700"
          />

          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700"
          />

          <button
            onClick={loadHistory}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-3 rounded-lg flex items-center gap-2 justify-center"
          >
            <Filter className="w-4 h-4" /> Apply
          </button>

          <button
            onClick={exportCSV}
            className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-4 py-3 rounded-lg flex items-center gap-2 justify-center"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 dark:bg-gray-700/40">
            <tr>
              <th className="p-4 text-left">Date</th>
              <th className="p-4 text-left">Category</th>
              <th className="p-4 text-left">Product</th>
              <th className="p-4 text-left">Size</th>
              <th className="p-4 text-left">Color</th>
              <th className="p-4 text-center">Qty</th>
              <th className="p-4 text-center">Action</th>
              <th className="p-4 text-center">Prev → New</th>
              <th className="p-4 text-center">Price</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-6 text-gray-500 dark:text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-6 text-gray-500 dark:text-gray-400">
                  No stock changes found
                </td>
              </tr>
            ) : (
              data.map((h) => (
                <tr
                  key={h.Id}
                  className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td className="p-4 text-sm">
                    {new Date(h.CreatedAt).toLocaleString()}
                  </td>
                  <td className="p-4">{h.CategoryName}</td>
                  <td className="p-4 font-semibold">{h.ProductName}</td>
                  <td className="p-4 text-center">{h.SizeName || "-"}</td>
                  <td className="p-4 text-center">{h.ColorName || "-"}</td>
                  <td className="p-4 text-center font-bold">
                    {h.ChangeQty > 0 ? (
                      <span className="text-green-600 dark:text-green-400">+{h.ChangeQty}</span>
                    ) : (
                      <span className="text-red-500 dark:text-red-400">{h.ChangeQty}</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {h.Reason === "add" ? (
                      <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-full text-xs font-medium flex items-center justify-center gap-1">
                        <PlusCircle className="w-3.5 h-3.5" /> Add
                      </span>
                    ) : (
                      <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-1 rounded-full text-xs font-medium flex items-center justify-center gap-1">
                        <MinusCircle className="w-3.5 h-3.5" /> Remove
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-center text-sm">
                    {h.PreviousQty ?? "-"} → {h.NewQty ?? "-"}
                  </td>
                  <td className="p-4 text-center text-sm">
                    {h.PriceAtChange ? `Rs. ${h.PriceAtChange.toFixed(2)}` : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
