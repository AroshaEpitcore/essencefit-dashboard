"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  getLookups,
  getProductsByCategory,
  getSizes,
  getVariantsByProductAndSize,
  sellStock,
  recordBackfill,
} from "./actions";
import { Zap, Package, ShoppingCart, Clock, TrendingUp } from "lucide-react";

export default function SalesPage() {
  const [lookups, setLookups] = useState<any>({ categories: [] });
  const [products, setProducts] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);

  const [selectedCat, setSelectedCat] = useState("");
  const [selectedProd, setSelectedProd] = useState("");
  const [selectedSize, setSelectedSize] = useState("");

  // Backfill form
  const [backfill, setBackfill] = useState({
    date: "",
    qty: "",
    cost: "",
    price: "",
  });

  useEffect(() => {
    loadLookups();
  }, []);

  async function loadLookups() {
    const res = await getLookups();
    setLookups(res);
  }

  async function handleCategoryChange(catId: string) {
    setSelectedCat(catId);
    setSelectedProd("");
    setSelectedSize("");
    setVariants([]);
    if (!catId) return;
    const prods = await getProductsByCategory(catId);
    setProducts(prods);
  }

  async function handleProductChange(prodId: string) {
    setSelectedProd(prodId);
    setSelectedSize("");
    setVariants([]);
    if (!prodId) return;
    const s = await getSizes(prodId);
    setSizes(s);
  }

  async function handleSizeChange(sizeId: string) {
    setSelectedSize(sizeId);
    if (!selectedProd || !sizeId) {
      setVariants([]);
      return;
    }
    const vars = await getVariantsByProductAndSize(selectedProd, sizeId);
    setVariants(
      vars.map((v) => ({
        ...v,
        _sellQty: 1,
        _sellPrice: v.SellingPrice ?? "",
      }))
    );
  }

  async function handleSell(v: any, qty: number) {
    try {
      await sellStock(v.Id, qty, v._sellPrice || v.SellingPrice);
      toast.success(`Sold ${qty} unit(s) at Rs ${v._sellPrice || v.SellingPrice}`);
      if (selectedProd && selectedSize) handleSizeChange(selectedSize);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleBackfill() {
    try {
      if (!selectedProd) return toast.error("Pick a product first");

      await recordBackfill(
        selectedProd,
        backfill.date,
        Number(backfill.qty || 0),
        Number(backfill.cost || 0),
        Number(backfill.price || 0)
      );

      toast.success("Backfill recorded!");
      setBackfill({ date: "", qty: "", cost: "", price: "" });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-primary/20 p-3 rounded-lg">
          <ShoppingCart className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Sales</h1>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          Select Product Variant
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              value={selectedCat}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="">-- Select Category --</option>
              {lookups.categories?.map((c: any) => (
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
              value={selectedProd}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
              disabled={!selectedCat}
            >
              <option value="">-- Select Product --</option>
              {products.map((p: any) => (
                <option key={p.Id} value={p.Id}>
                  {p.Name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Size
            </label>
            <select
              value={selectedSize}
              onChange={(e) => handleSizeChange(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
              disabled={!selectedProd}
            >
              <option value="">-- Select Size --</option>
              {sizes.map((s: any) => (
                <option key={s.Id} value={s.Id}>
                  {s.Name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Variants Table */}
      {variants.length > 0 && (
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-8">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Available Variants
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700/50">
                <tr>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Size</th>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Color</th>
                  <th className="p-4 text-center font-semibold text-gray-700 dark:text-gray-300">In Stock</th>
                  <th className="p-4 text-center font-semibold text-gray-700 dark:text-gray-300">Sell Price</th>
                  <th className="p-4 text-center font-semibold text-gray-700 dark:text-gray-300">Qty</th>
                  <th className="p-4 text-center font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v, i) => (
                  <tr
                    key={v.Id}
                    className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="p-4">{v.Size}</td>
                    <td className="p-4">{v.Color}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        v.Qty < 10 
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' 
                          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {v.Qty}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <input
                        type="number"
                        step="0.01"
                        value={v._sellPrice ?? ""}
                        placeholder="Price"
                        onChange={(e) => {
                          const price = e.target.value === "" ? "" : parseFloat(e.target.value);
                          const updated = [...variants];
                          updated[i]._sellPrice = price;
                          setVariants(updated);
                        }}
                        className="w-24 bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-center text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      />
                    </td>
                    <td className="p-4 text-center">
                      <input
                        type="number"
                        min="1"
                        value={v._sellQty ?? 1}
                        placeholder="Qty"
                        onChange={(e) => {
                          const qty = parseInt(e.target.value) || 1;
                          const updated = [...variants];
                          updated[i]._sellQty = qty;
                          setVariants(updated);
                        }}
                        className="w-20 bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-center text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleSell(v, 1)}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium transition-colors"
                        >
                          <Zap className="w-4 h-4" /> +1
                        </button>
                        <button
                          onClick={() => handleSell(v, v._sellQty)}
                          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          Sell
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Backfill Section */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Backfill Pre-System Sales
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date
            </label>
            <input
              type="date"
              value={backfill.date}
              onChange={(e) => setBackfill({ ...backfill, date: e.target.value })}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Qty (Sold)
            </label>
            <input
              type="number"
              placeholder="e.g. 50"
              value={backfill.qty}
              onChange={(e) => setBackfill({ ...backfill, qty: e.target.value })}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Unit Cost (Rs)
            </label>
            <input
              type="number"
              placeholder="e.g. 250"
              value={backfill.cost}
              onChange={(e) => setBackfill({ ...backfill, cost: e.target.value })}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Unit Selling (Rs)
            </label>
            <input
              type="number"
              placeholder="e.g. 350"
              value={backfill.price}
              onChange={(e) => setBackfill({ ...backfill, price: e.target.value })}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
        </div>
        <button
          onClick={handleBackfill}
          className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          Record Backfill
        </button>
      </div>
    </div>
  );
}