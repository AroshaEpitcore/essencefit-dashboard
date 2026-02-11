"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  getColorRequests,
  createColorRequest,
  updateColorRequest,
  updateColorRequestStatus,
  deleteColorRequest,
  getCategories,
  getProductsByCategory,
  getSizesByProduct,
  getAllColors,
  getAllSizes,
} from "./actions";
import {
  Palette,
  Trash2,
  Edit3,
  X,
  Search,
  User,
  Phone,
  ShoppingBag,
  Pipette,
  Ruler,
  FileText,
  ChevronLeft,
  ChevronRight,
  Layers,
  ChevronDown,
} from "lucide-react";
import { formatPhone, cleanPhoneInput } from "@/lib/phoneMask";

type Opt = { Id: string; Name: string };

type ColorRequest = {
  Id: string;
  CustomerName: string;
  Phone: string | null;
  ProductName: string;
  ColorName: string;
  SizeName: string | null;
  Notes: string | null;
  Status: string;
  CreatedAt: string;
};

type GroupedRequest = {
  key: string;
  CustomerName: string;
  Phone: string | null;
  ProductName: string;
  SizeName: string | null;
  Notes: string | null;
  Colors: { Id: string; Name: string; Status: string }[];
  CreatedAt: string;
  Ids: string[];
};

type SelectedColor = { Id: string; Name: string };

type FormData = {
  EditIds?: string[];
  EditColorNames?: string[];
  CustomerName: string;
  Phone: string;
  CategoryId: string;
  ProductId: string;
  ProductName: string;
  SizeId: string;
  SizeName: string;
  SelectedColors: SelectedColor[];
  Notes: string;
};

const STATUSES = ["Pending", "Notified", "Fulfilled"] as const;

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  Notified: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Fulfilled: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const emptyForm: FormData = {
  CustomerName: "",
  Phone: "",
  CategoryId: "",
  ProductId: "",
  ProductName: "",
  SizeId: "",
  SizeName: "",
  SelectedColors: [],
  Notes: "",
};

const selectClass =
  "w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none";

const inputClass =
  "w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all";

export default function ColorRequestsPage() {
  const [requests, setRequests] = useState<ColorRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormData>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Dropdown options
  const [categories, setCategories] = useState<Opt[]>([]);
  const [products, setProducts] = useState<Opt[]>([]);
  const [sizes, setSizes] = useState<Opt[]>([]);
  const [allColors, setAllColors] = useState<Opt[]>([]);
  const [allSizes, setAllSizes] = useState<Opt[]>([]);

  async function load() {
    setLoading(true);
    try {
      const data = await getColorRequests();
      setRequests(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const [cats, ac, as_] = await Promise.all([
        getCategories(),
        getAllColors(),
        getAllSizes(),
      ]);
      setCategories(cats);
      setAllColors(ac);
      setAllSizes(as_);
    } catch {}
  }

  useEffect(() => {
    load();
    loadCategories();
  }, []);

  // Cascade: category → products
  useEffect(() => {
    if (!form.CategoryId) { setProducts([]); return; }
    getProductsByCategory(form.CategoryId).then(setProducts).catch(() => setProducts([]));
  }, [form.CategoryId]);

  // Cascade: product → sizes
  useEffect(() => {
    if (!form.ProductId) { setSizes([]); return; }
    getSizesByProduct(form.ProductId).then(setSizes).catch(() => setSizes([]));
  }, [form.ProductId]);

  const filtered = requests.filter((r) => {
    const q = search.toLowerCase();
    return (
      (r.CustomerName || "").toLowerCase().includes(q) ||
      (r.Phone || "").includes(q) ||
      r.ProductName.toLowerCase().includes(q) ||
      r.ColorName.toLowerCase().includes(q)
    );
  });

  // Group by customer+phone+product+size
  const grouped: GroupedRequest[] = [];
  const groupMap = new Map<string, GroupedRequest>();
  for (const r of filtered) {
    const key = `${(r.Phone || "").toLowerCase()}|${r.ProductName.toLowerCase()}|${(r.SizeName || "").toLowerCase()}`;
    let g = groupMap.get(key);
    if (!g) {
      g = {
        key,
        CustomerName: r.CustomerName,
        Phone: r.Phone,
        ProductName: r.ProductName,
        SizeName: r.SizeName,
        Notes: r.Notes,
        Colors: [],
        CreatedAt: r.CreatedAt,
        Ids: [],
      };
      groupMap.set(key, g);
      grouped.push(g);
    }
    g.Colors.push({ Id: r.Id, Name: r.ColorName, Status: r.Status });
    g.Ids.push(r.Id);
    // Keep earliest date
    if (new Date(r.CreatedAt) < new Date(g.CreatedAt)) g.CreatedAt = r.CreatedAt;
  }

  const totalPages = Math.ceil(grouped.length / itemsPerPage);
  const paginated = grouped.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const productName = form.ProductName || products.find((p) => p.Id === form.ProductId)?.Name || "";
    const sizeName = form.SizeName || allSizes.find((s) => s.Id === form.SizeId)?.Name || "";

    if (!productName) {
      toast.error("Please select a product");
      return;
    }

    if (editing && form.EditIds) {
      if (form.SelectedColors.length === 0) { toast.error("Please select at least one color"); return; }
      const origIds = form.EditIds;
      const origNames = form.EditColorNames || [];
      const newNames = form.SelectedColors.map((c) => c.Name);

      try {
        // Update existing records that are still selected
        const toUpdate: Promise<any>[] = [];
        for (let i = 0; i < origIds.length; i++) {
          if (newNames.includes(origNames[i])) {
            toUpdate.push(updateColorRequest(
              origIds[i], form.CustomerName || null, form.Phone,
              productName, origNames[i], sizeName || null, form.Notes || null
            ));
          }
        }

        // Delete removed colors
        const removedNames = origNames.filter((n) => !newNames.includes(n));
        const toDelete: Promise<any>[] = [];
        for (let i = 0; i < origIds.length; i++) {
          if (removedNames.includes(origNames[i])) {
            toDelete.push(deleteColorRequest(origIds[i]));
          }
        }

        // Create newly added colors
        const addedNames = newNames.filter((n) => !origNames.includes(n));
        const toCreate = addedNames.map((colorName) =>
          createColorRequest(
            form.CustomerName || null, form.Phone,
            productName, colorName, sizeName || null, form.Notes || null
          )
        );

        await Promise.all([...toUpdate, ...toDelete, ...toCreate]);
        toast.success("Request updated");
        setForm(emptyForm);
        setEditing(false);
        load();
      } catch (err: any) {
        toast.error(err.message || "Save failed");
      }
    } else {
      // Create mode: one record per selected color
      if (form.SelectedColors.length === 0) { toast.error("Please select at least one color"); return; }
      try {
        await Promise.all(
          form.SelectedColors.map((c) =>
            createColorRequest(
              form.CustomerName || null,
              form.Phone,
              productName,
              c.Name,
              sizeName || null,
              form.Notes || null
            )
          )
        );
        toast.success(`${form.SelectedColors.length} request${form.SelectedColors.length > 1 ? "s" : ""} added`);
        setForm(emptyForm);
        load();
      } catch (err: any) {
        toast.error(err.message || "Save failed");
      }
    }
  }

  async function handleStatusChange(colorId: string, currentStatus: string) {
    const idx = STATUSES.indexOf(currentStatus as any);
    const next = STATUSES[(idx + 1) % STATUSES.length];
    try {
      await updateColorRequestStatus(colorId, next);
      setRequests((prev) =>
        prev.map((r) => (r.Id === colorId ? { ...r, Status: next } : r))
      );
      toast.success(`Status changed to ${next}`);
    } catch (err: any) {
      toast.error("Failed to update status");
    }
  }

  async function handleGroupStatusChange(ids: string[], currentStatuses: string[]) {
    // Use the most common status to determine next
    const mostCommon = currentStatuses.sort((a, b) =>
      currentStatuses.filter((s) => s === b).length - currentStatuses.filter((s) => s === a).length
    )[0];
    const idx = STATUSES.indexOf(mostCommon as any);
    const next = STATUSES[(idx + 1) % STATUSES.length];
    try {
      await Promise.all(ids.map((id) => updateColorRequestStatus(id, next)));
      setRequests((prev) =>
        prev.map((r) => (ids.includes(r.Id) ? { ...r, Status: next } : r))
      );
      toast.success(`All statuses changed to ${next}`);
    } catch (err: any) {
      toast.error("Failed to update status");
    }
  }

  async function handleDeleteGroup(ids: string[]) {
    if (!confirm(`Delete ${ids.length} request${ids.length > 1 ? "s" : ""}?`)) return;
    try {
      await Promise.all(ids.map((id) => deleteColorRequest(id)));
      toast.success("Requests deleted");
      load();
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  }

  function openEditGroup(g: GroupedRequest) {
    const selectedColors: SelectedColor[] = g.Colors.map((c) => {
      const matched = allColors.find((ac) => ac.Name === c.Name);
      return matched || { Id: c.Id, Name: c.Name };
    });
    setEditing(true);
    setForm({
      EditIds: g.Ids,
      EditColorNames: g.Colors.map((c) => c.Name),
      CustomerName: g.CustomerName,
      Phone: g.Phone || "",
      CategoryId: "",
      ProductId: "",
      ProductName: g.ProductName,
      SizeId: "",
      SizeName: g.SizeName || "",
      SelectedColors: selectedColors,
      Notes: g.Notes || "",
    });
  }

  function handleCategoryChange(catId: string) {
    setForm({ ...form, CategoryId: catId, ProductId: "", ProductName: "", SizeId: "", SizeName: "", SelectedColors: [] });
  }

  function handleProductChange(prodId: string) {
    const name = products.find((p) => p.Id === prodId)?.Name || "";
    setForm({ ...form, ProductId: prodId, ProductName: name, SizeId: "", SizeName: "", SelectedColors: [] });
  }

  function handleSizeChange(sizeId: string) {
    const name = allSizes.find((s) => s.Id === sizeId)?.Name || "";
    setForm({ ...form, SizeId: sizeId, SizeName: name });
  }

  function handleAddColor(colorId: string) {
    if (!colorId) return;
    const color = allColors.find((c) => c.Id === colorId);
    if (!color || form.SelectedColors.some((sc) => sc.Id === colorId)) return;
    setForm({ ...form, SelectedColors: [...form.SelectedColors, color] });
  }

  function handleRemoveColor(colorId: string) {
    setForm({ ...form, SelectedColors: form.SelectedColors.filter((c) => c.Id !== colorId) });
  }

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header + Form */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-primary/20 p-3 rounded-lg">
            <Palette className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{editing ? "Edit Color Request" : "Color Requests"}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {grouped.length} request{grouped.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Customer Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" /> Customer Name
                </label>
                <input
                  value={form.CustomerName}
                  onChange={(e) => setForm({ ...form, CustomerName: e.target.value })}
                  placeholder="Enter customer name (optional)"
                  className={inputClass}
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Phone *
                </label>
                <input
                  value={formatPhone(form.Phone)}
                  onChange={(e) => setForm({ ...form, Phone: cleanPhoneInput(e.target.value) })}
                  placeholder="0XX XXX XXXX"
                  required
                  className={inputClass}
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Category *
                </label>
                <div className="relative">
                  <select
                    value={form.CategoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    required
                    className={selectClass}
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.Id} value={c.Id}>{c.Name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Product */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" /> Product *
                </label>
                <div className="relative">
                  <select
                    value={form.ProductId}
                    onChange={(e) => handleProductChange(e.target.value)}
                    required
                    disabled={!form.CategoryId}
                    className={`${selectClass} disabled:opacity-50`}
                  >
                    <option value="">{form.CategoryId ? "Select product" : "Select category first"}</option>
                    {products.map((p) => (
                      <option key={p.Id} value={p.Id}>{p.Name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Ruler className="w-4 h-4" /> Size
                </label>
                <div className="relative">
                  <select
                    value={form.SizeId}
                    onChange={(e) => handleSizeChange(e.target.value)}
                    disabled={!form.ProductId}
                    className={`${selectClass} disabled:opacity-50`}
                  >
                    <option value="">{form.ProductId ? "Select size" : "Select product first"}</option>
                    {(form.ProductId ? sizes : allSizes).map((s) => (
                      <option key={s.Id} value={s.Id}>{s.Name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Pipette className="w-4 h-4" /> {editing ? "Color *" : "Colors *"}
                </label>
                <div className="relative">
                  <select
                    value=""
                    onChange={(e) => handleAddColor(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Select color{editing ? "" : "(s)"}</option>
                    {allColors
                      .filter((c) => !form.SelectedColors.some((sc) => sc.Id === c.Id))
                      .map((c) => (
                        <option key={c.Id} value={c.Id}>{c.Name}</option>
                      ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                {form.SelectedColors.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.SelectedColors.map((c) => (
                      <span
                        key={c.Id || c.Name}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                      >
                        {c.Name}
                        <button
                          type="button"
                          onClick={() => handleRemoveColor(c.Id)}
                          className="hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Notes - full width */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Notes
              </label>
              <input
                value={form.Notes}
                onChange={(e) => setForm({ ...form, Notes: e.target.value })}
                placeholder="Additional notes (optional)"
                className={inputClass}
              />
            </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            {editing && (
              <button
                type="button"
                onClick={() => { setForm(emptyForm); setEditing(false); }}
                className="px-6 py-2.5 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel Edit
              </button>
            )}
            <button
              type="submit"
              className="bg-primary hover:bg-primary/90 transition-colors px-6 py-2.5 rounded-lg font-semibold text-white"
            >
              {editing ? "Update" : "Save"} Request
            </button>
          </div>
        </form>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          placeholder="Search by customer, phone, product or color..."
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder-gray-500 dark:placeholder-gray-400"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Palette className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No color requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700/50">
                <tr>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Customer</th>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Phone</th>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Product</th>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Colors</th>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Size</th>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Date</th>
                  <th className="p-4 text-center font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((g) => (
                  <tr
                    key={g.key}
                    className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="p-4 font-medium">{g.CustomerName || "-"}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">
                      {g.Phone ? formatPhone(g.Phone) : "-"}
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">{g.ProductName}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {g.Colors.map((c) => (
                          <button
                            key={c.Id}
                            onClick={() => handleStatusChange(c.Id, c.Status)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-opacity hover:opacity-80 ${STATUS_STYLES[c.Status] || STATUS_STYLES.Pending}`}
                            title={`${c.Name} — ${c.Status} (click to change)`}
                          >
                            <Pipette className="w-3 h-3" />
                            {c.Name}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">{g.SizeName || "-"}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">
                      {new Date(g.CreatedAt).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => openEditGroup(g)}
                          className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(g.Ids)}
                          className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === p
                    ? "bg-primary text-white"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
