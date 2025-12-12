"use client";

import { useEffect, useState } from "react";
import { getCategories, getProductsByCategory, getSizesByProduct, getColorsByProductAndSize, getVariant, createSalesReturn, getRecentReturns } from "./actions";
import toast, { Toaster } from "react-hot-toast";
import { Plus, Trash2, RotateCcw, ShoppingCart, Save, Clock } from "lucide-react";

export default function ReturnsPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);

  const [selCat, setSelCat] = useState("");
  const [selProd, setSelProd] = useState("");
  const [selSize, setSelSize] = useState("");
  const [selColor, setSelColor] = useState("");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    getCategories().then(setCategories);
    loadRecent();
  }, []);

  async function loadRecent() {
    setRecent(await getRecentReturns(10));
  }

  async function pickCategory(id: string) {
    setSelCat(id);
    setProducts([]);
    setSelProd("");
    if (id) setProducts(await getProductsByCategory(id));
  }
  async function pickProduct(id: string) {
    setSelProd(id);
    setSizes([]);
    setSelSize("");
    if (id) setSizes(await getSizesByProduct(id));
  }
  async function pickSize(id: string) {
    setSelSize(id);
    setColors([]);
    setSelColor("");
    if (id && selProd) setColors(await getColorsByProductAndSize(selProd, id));
  }

  async function addItem() {
    if (!selProd || !selSize || !selColor) {
      toast.error("Pick all options");
      return;
    }
    const v = await getVariant(selProd, selSize, selColor);
    if (!v) return toast.error("Variant not found");
    setItems([...items, { VariantId: v.VariantId, Qty: qty }]);
    setQty(1);
  }

  async function saveReturn() {
    if (!items.length) {
      toast.error("Add at least one item");
      return;
    }
    try {
      await createSalesReturn(null, reason, items);
      toast.success("Return saved");
      setItems([]);
      setReason("");
      loadRecent();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  }

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-primary/20 p-3 rounded-lg">
          <RotateCcw className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Sales Returns</h1>
      </div>

      {/* Return Form */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Create Return
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason for Return
            </label>
            <input
              placeholder="e.g. Defective, Wrong size, Customer request"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Product Variant
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <select 
                value={selCat} 
                onChange={(e) => pickCategory(e.target.value)} 
                className="bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              >
                <option value="">Category</option>
                {categories.map((c) => <option key={c.Id} value={c.Id}>{c.Name}</option>)}
              </select>
              <select 
                value={selProd} 
                onChange={(e) => pickProduct(e.target.value)} 
                className="bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
                disabled={!selCat}
              >
                <option value="">Product</option>
                {products.map((p) => <option key={p.Id} value={p.Id}>{p.Name}</option>)}
              </select>
              <select 
                value={selSize} 
                onChange={(e) => pickSize(e.target.value)} 
                className="bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
                disabled={!selProd}
              >
                <option value="">Size</option>
                {sizes.map((s) => <option key={s.Id} value={s.Id}>{s.Name}</option>)}
              </select>
              <select 
                value={selColor} 
                onChange={(e) => setSelColor(e.target.value)} 
                className="bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
                disabled={!selSize}
              >
                <option value="">Color</option>
                {colors.map((c) => <option key={c.Id} value={c.Id}>{c.Name}</option>)}
              </select>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value) || 1)}
                placeholder="Qty"
                className="bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
          </div>

          <button 
            onClick={addItem} 
            className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Item to Return
          </button>
        </div>
      </div>

      {/* Items Table */}
      {items.length > 0 && (
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Return Items ({items.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700/50">
                <tr>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Variant ID</th>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Quantity</th>
                  <th className="p-4 text-center font-semibold text-gray-700 dark:text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="p-4">
                      <code className="px-2 py-1 bg-gray-100 dark:bg-gray-900/50 rounded text-sm font-mono">
                        {it.VariantId}
                      </code>
                    </td>
                    <td className="p-4 font-medium">{it.Qty}</td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => setItems(items.filter((_, idx) => idx !== i))} 
                        className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button 
              onClick={saveReturn} 
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-colors"
            >
              <Save className="w-4 h-4" /> Save Return
            </button>
          </div>
        </div>
      )}

      {/* Recent Returns */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Recent Returns
        </h2>
        {recent.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <RotateCcw className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No returns yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map((r) => (
              <div key={r.Id} className="border border-gray-200 dark:border-gray-700 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {r.Reason || <span className="text-gray-400 italic">No reason provided</span>}
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">
                    {r.ItemCount} item{r.ItemCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(r.CreatedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}