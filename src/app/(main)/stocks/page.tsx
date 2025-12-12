"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  getLookups,
  addCategory,
  updateCategory,
  deleteCategory,
  addSize,
  updateSize,
  deleteSize,
  addColor,
  updateColor,
  deleteColor,
  getProductsByCategory,
  addProduct,
  updateProduct,
  deleteProduct,
  quickStock,
} from "./actions";
import {
  Tag,
  Ruler,
  Palette,
  Package,
  Plus,
  Trash2,
  Edit,
  AlertTriangle,
  X,
} from "lucide-react";

export default function StocksPage() {
  const [lookups, setLookups] = useState<any>({
    categories: [],
    sizes: [],
    colors: [],
  });
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCat, setSelectedCat] = useState("");

  const [newCategory, setNewCategory] = useState("");
  const [newSize, setNewSize] = useState("");
  const [newColor, setNewColor] = useState("");

  const [pName, setPName] = useState("");
  const [pCost, setPCost] = useState("");
  const [pSell, setPSell] = useState("");

  // Modals
  const [editItem, setEditItem] = useState<any | null>(null); // {type, id, name, cost, sell}
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(false);

  useEffect(() => {
    refreshLookups();
  }, []);

  async function refreshLookups() {
    const data = await getLookups();
    setLookups(data);
  }

  async function refreshProducts(catId: string) {
    if (!catId) {
      setProducts([]);
      return;
    }
    const rows = await getProductsByCategory(catId);
    setProducts(rows);
  }

  async function handleQuickStock(action: "add" | "remove") {
    const productId = (document.getElementById("qProduct") as HTMLSelectElement)
      .value;
    const sizeId = (document.getElementById("qSize") as HTMLSelectElement)
      .value;
    const colorId = (document.getElementById("qColor") as HTMLSelectElement)
      .value;
    const qty = parseInt(
      (document.getElementById("qQty") as HTMLInputElement).value
    );
    const price = Number(
      (document.getElementById("qCost") as HTMLInputElement).value
    );

    if (!productId || !sizeId || !colorId || !qty) {
      toast.error("Please fill all fields!");
      return;
    }

    if (action === "remove") {
      setShowConfirm(true);
      return;
    }

    await performStockAction("add", productId, sizeId, colorId, qty, price);
  }

  async function performStockAction(
    action: "add" | "remove",
    productId: string,
    sizeId: string,
    colorId: string,
    qty: number,
    price: number
  ) {
    try {
      setPendingRemove(true);
      await quickStock(productId, sizeId, colorId, qty, price, action);
      toast.success(
        `Stock ${action === "add" ? "added" : "removed"} successfully!`
      );
      setShowConfirm(false);

      // clear fields
      ["qProduct", "qSize", "qColor", "qQty", "qCost"].forEach((id) => {
        const el = document.getElementById(id) as
          | HTMLInputElement
          | HTMLSelectElement;
        if (el) el.value = "";
      });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPendingRemove(false);
    }
  }

  // ------------------- CRUD Handlers -------------------
  async function handleAddCategory() {
    try {
      await addCategory(newCategory);
      toast.success("Category added");
      setNewCategory("");
      refreshLookups();
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function handleAddSize() {
    try {
      await addSize(newSize);
      toast.success("Size added");
      setNewSize("");
      refreshLookups();
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function handleAddColor() {
    try {
      await addColor(newColor);
      toast.success("Color added");
      setNewColor("");
      refreshLookups();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleAddProduct() {
    try {
      await addProduct(selectedCat, pName, Number(pCost), Number(pSell));
      toast.success("Product added");
      setPName("");
      setPCost("");
      setPSell("");
      refreshProducts(selectedCat);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleSaveEdit() {
    if (!editItem) return;
    try {
      if (editItem.type === "category") {
        await updateCategory(editItem.id, editItem.name);
      } else if (editItem.type === "size") {
        await updateSize(editItem.id, editItem.name);
      } else if (editItem.type === "color") {
        await updateColor(editItem.id, editItem.name);
      } else if (editItem.type === "product") {
        await updateProduct(
          editItem.id,
          editItem.name,
          Number(editItem.cost),
          Number(editItem.sell)
        );
      }
      toast.success("Updated");
      setEditItem(null);
      refreshLookups();
      if (editItem.type === "product") refreshProducts(selectedCat);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(type: string, id: string) {
    if (!confirm(`Delete this Rs.{type}?`)) return;
    try {
      if (type === "category") await deleteCategory(id);
      if (type === "size") await deleteSize(id);
      if (type === "color") await deleteColor(id);
      if (type === "product") await deleteProduct(id);
      toast.success("Deleted");
      refreshLookups();
      if (type === "product") refreshProducts(selectedCat);
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
          <Package className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Stock Management</h1>
      </div>

      {/* Categories Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          Categories
        </h2>
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 p-5 rounded-xl">
          <div className="flex gap-3 mb-4">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="New category"
              className="flex-1 bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
            <button
              onClick={handleAddCategory}
              className="bg-primary hover:bg-primary/90 transition-colors px-6 py-3 rounded-lg font-semibold text-white"
            >
              Add
            </button>
          </div>
          <ul className="space-y-2">
            {lookups.categories.map((c: any) => (
              <li
                key={c.Id}
                className="flex justify-between items-center bg-gray-100 dark:bg-gray-700/30 px-4 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors"
              >
                <span className="font-medium">{c.Name}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setEditItem({ type: "category", id: c.Id, name: c.Name })
                    }
                    className="text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1 px-2 py-1"
                  >
                    <Edit className="w-4 h-4" />
                    <span className="text-sm">Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete("category", c.Id)}
                    className="text-red-500 hover:text-red-400 transition-colors flex items-center gap-1 px-2 py-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm">Delete</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Sizes & Colors */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Sizes & Colors
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sizes */}
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 p-5 rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <Ruler className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Sizes</h3>
            </div>
            <div className="flex gap-3 mb-4">
              <input
                value={newSize}
                onChange={(e) => setNewSize(e.target.value)}
                placeholder="New size"
                className="flex-1 bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
              <button
                onClick={handleAddSize}
                className="bg-primary hover:bg-primary/90 transition-colors px-6 py-3 rounded-lg font-semibold text-white"
              >
                Add
              </button>
            </div>
            <ul className="space-y-2">
              {lookups.sizes.map((s: any) => (
                <li
                  key={s.Id}
                  className="flex justify-between items-center bg-gray-100 dark:bg-gray-700/30 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <span className="text-sm">{s.Name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setEditItem({ type: "size", id: s.Id, name: s.Name })
                      }
                      className="text-blue-500 hover:text-blue-400 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete("size", s.Id)}
                      className="text-red-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Colors */}
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 p-5 rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Colors</h3>
            </div>
            <div className="flex gap-3 mb-4">
              <input
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                placeholder="New color"
                className="flex-1 bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
              <button
                onClick={handleAddColor}
                className="bg-primary hover:bg-primary/90 transition-colors px-6 py-3 rounded-lg font-semibold text-white"
              >
                Add
              </button>
            </div>
            <ul className="space-y-2">
              {lookups.colors.map((c: any) => (
                <li
                  key={c.Id}
                  className="flex justify-between items-center bg-gray-100 dark:bg-gray-700/30 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <span className="text-sm">{c.Name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setEditItem({ type: "color", id: c.Id, name: c.Name })
                      }
                      className="text-blue-500 hover:text-blue-400 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete("color", c.Id)}
                      className="text-red-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Products */}
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          Create Products
        </h2>
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 p-5 rounded-xl">
          <select
            value={selectedCat}
            onChange={(e) => {
              setSelectedCat(e.target.value);
              refreshProducts(e.target.value);
            }}
            className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all mb-4"
          >
            <option value="">--Select Category--</option>
            {lookups.categories.map((c: any) => (
              <option key={c.Id} value={c.Id}>
                {c.Name}
              </option>
            ))}
          </select>

          {selectedCat && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <input
                  placeholder="Name"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  className="bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
                <input
                  placeholder="Cost"
                  value={pCost}
                  onChange={(e) => setPCost(e.target.value)}
                  className="bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
                <input
                  placeholder="Sell"
                  value={pSell}
                  onChange={(e) => setPSell(e.target.value)}
                  className="bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
                <button
                  onClick={handleAddProduct}
                  className="bg-primary hover:bg-primary/90 transition-colors px-4 py-3 rounded-lg font-semibold text-white"
                >
                  Add Product
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-gray-700/50">
                    <tr>
                      <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">
                        Name
                      </th>
                      <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">
                        Cost
                      </th>
                      <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">
                        Sell
                      </th>
                      <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr
                        key={p.Id}
                        className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        <td className="p-4 font-medium">{p.Name}</td>
                        <td className="p-4">Rs.{p.CostPrice}</td>
                        <td className="p-4 font-semibold text-green-600 dark:text-green-400">
                          Rs.{p.SellingPrice}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                setEditItem({
                                  type: "product",
                                  id: p.Id,
                                  name: p.Name,
                                  cost: p.CostPrice,
                                  sell: p.SellingPrice,
                                })
                              }
                              className="text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span className="text-xs">Edit</span>
                            </button>
                            <button
                              onClick={() => handleDelete("product", p.Id)}
                              className="text-red-500 hover:text-red-400 transition-colors flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="text-xs">Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
      {/* Quick Stock Section */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Quick Add / Remove Stock
        </h2>
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 p-5 rounded-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <select
              value={selectedCat}
              onChange={(e) => {
                setSelectedCat(e.target.value);
                refreshProducts(e.target.value);
              }}
              className="bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="">Category</option>
              {lookups.categories.map((c: any) => (
                <option key={c.Id} value={c.Id}>
                  {c.Name}
                </option>
              ))}
            </select>

            <select
              id="qProduct"
              className="bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="">Product</option>
              {products.map((p) => (
                <option key={p.Id} value={p.Id}>
                  {p.Name}
                </option>
              ))}
            </select>

            <select
              id="qSize"
              className="bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="">Size</option>
              {lookups.sizes.map((s: any) => (
                <option key={s.Id} value={s.Id}>
                  {s.Name}
                </option>
              ))}
            </select>

            <select
              id="qColor"
              className="bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="">Color</option>
              {lookups.colors.map((c: any) => (
                <option key={c.Id} value={c.Id}>
                  {c.Name}
                </option>
              ))}
            </select>

            <input
              id="qQty"
              type="number"
              placeholder="Qty"
              className="bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />

            <input
              id="qCost"
              type="number"
              placeholder="Price"
              className="bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          {/* Quick Stock Buttons */}
          <div className="flex flex-col md:flex-row gap-3">
            <button
              onClick={async () => await handleQuickStock("remove")}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              − Remove Stock
            </button>
            <button
              onClick={async () => await handleQuickStock("add")}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              + Add Stock
            </button>
          </div>

          
        </div>
      </section>

      {/* EDIT MODAL */}
      {editItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Edit{" "}
                {editItem.type.charAt(0).toUpperCase() + editItem.type.slice(1)}
              </h3>
              <button
                onClick={() => setEditItem(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name
                </label>
                <input
                  value={editItem.name}
                  onChange={(e) =>
                    setEditItem({ ...editItem, name: e.target.value })
                  }
                  className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>

              {editItem.type === "product" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cost Price
                    </label>
                    <input
                      type="number"
                      value={editItem.cost}
                      onChange={(e) =>
                        setEditItem({ ...editItem, cost: e.target.value })
                      }
                      placeholder="Cost"
                      className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Selling Price
                    </label>
                    <input
                      type="number"
                      value={editItem.sell}
                      onChange={(e) =>
                        setEditItem({ ...editItem, sell: e.target.value })
                      }
                      placeholder="Sell"
                      className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setEditItem(null)}
                className="px-6 py-2.5 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="bg-primary hover:bg-primary/90 transition-colors px-6 py-2.5 rounded-lg font-semibold text-white"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🧾 Confirmation Modal */}
          {showConfirm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Confirm Stock Removal
                  </h3>
                </div>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Are you sure you want to remove this stock quantity? This
                  action will reduce available stock and cannot be undone.
                </p>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-5 py-2.5 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const productId = (
                        document.getElementById("qProduct") as HTMLSelectElement
                      ).value;
                      const sizeId = (
                        document.getElementById("qSize") as HTMLSelectElement
                      ).value;
                      const colorId = (
                        document.getElementById("qColor") as HTMLSelectElement
                      ).value;
                      const qty = parseInt(
                        (document.getElementById("qQty") as HTMLInputElement)
                          .value
                      );
                      const price = Number(
                        (document.getElementById("qCost") as HTMLInputElement)
                          .value
                      );
                      await performStockAction(
                        "remove",
                        productId,
                        sizeId,
                        colorId,
                        qty,
                        price
                      );
                    }}
                    disabled={pendingRemove}
                    className={`px-6 py-2.5 rounded-lg font-semibold text-white ${
                      pendingRemove
                        ? "bg-red-400 cursor-not-allowed"
                        : "bg-red-600 hover:bg-red-700"
                    } transition-colors`}
                  >
                    {pendingRemove ? "Removing..." : "Confirm Remove"}
                  </button>
                </div>
              </div>
            </div>
          )}
    </div>
  );
}
