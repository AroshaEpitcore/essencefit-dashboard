"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  getCatalogProducts,
  getProductForEdit,
  updateProductStorefront,
  toggleProductFlag,
  getBlankCandidates,
  setProductImages,
  getProductDesigns,
  saveDesigns,
  getCatalogCategories,
  updateCategoryStorefront,
  getColorsAdmin,
  updateColorHex,
  type CatalogProduct,
  type CatalogCategory,
  type AdminColor,
} from "./actions";
import {
  Store, Edit3, X, Star, Sparkles, Printer, Eye, EyeOff, ImagePlus, Trash2, Tag, Package, Layers, Palette,
} from "lucide-react";
import { resolveSwatch } from "@/lib/colorHex";

async function uploadFile(file: File, folder: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.url as string;
}

const money = (n: number) => "Rs. " + Number(n || 0).toLocaleString();

type ImgItem = { url: string; colorId: string | null };

export default function CatalogPage() {
  const [tab, setTab] = useState<"products" | "categories" | "colors">("products");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [colors, setColors] = useState<AdminColor[]>([]);
  const [loading, setLoading] = useState(false);
  const [dealsOnly, setDealsOnly] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [p, c, cl] = await Promise.all([getCatalogProducts(), getCatalogCategories(), getColorsAdmin()]);
      setProducts(p);
      setCategories(c);
      setColors(cl);
    } catch (err: any) {
      toast.error(err.message || "Failed to load catalog");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const shownProducts = dealsOnly
    ? products.filter((p) => p.CompareAtPrice && p.CompareAtPrice > p.SellingPrice)
    : products;

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-3 rounded-lg">
            <Store className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Storefront Catalog</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Images, descriptions, cut prices & visibility for the website
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setTab("products")}
          className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
            tab === "products" ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
          }`}
        >
          <Package className="w-4 h-4" /> Products
        </button>
        <button
          onClick={() => setTab("categories")}
          className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
            tab === "categories" ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
          }`}
        >
          <Layers className="w-4 h-4" /> Categories
        </button>
        <button
          onClick={() => setTab("colors")}
          className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
            tab === "colors" ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
          }`}
        >
          <Palette className="w-4 h-4" /> Colours
        </button>
        {tab === "products" && (
          <label className="ml-auto flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={dealsOnly} onChange={(e) => setDealsOnly(e.target.checked)} />
            <Tag className="w-4 h-4" /> Deals only
          </label>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : tab === "products" ? (
        <ProductsTable products={shownProducts} reload={load} />
      ) : tab === "categories" ? (
        <CategoriesTable categories={categories} reload={load} />
      ) : (
        <ColorsTable colors={colors} reload={load} />
      )}
    </div>
  );
}

/* ---------------- Colours ---------------- */

function ColorsTable({ colors, reload }: { colors: AdminColor[]; reload: () => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function save(c: AdminColor) {
    const val = drafts[c.Id] ?? c.Hex ?? "";
    setSavingId(c.Id);
    try {
      await updateColorHex(c.Id, val || null);
      toast.success(`Saved ${c.Name}`);
      reload();
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
        Leave the hex empty to auto-pick a swatch from the colour name. Set a hex to override (e.g. for
        custom names like &ldquo;Navy Blue&rdquo;).
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 dark:bg-gray-700/50">
            <tr>
              <th className="p-3 text-left font-semibold">Swatch</th>
              <th className="p-3 text-left font-semibold">Name</th>
              <th className="p-3 text-left font-semibold">Hex</th>
              <th className="p-3 text-right font-semibold">Used by</th>
              <th className="p-3 text-center font-semibold">Save</th>
            </tr>
          </thead>
          <tbody>
            {colors.map((c) => {
              const draft = drafts[c.Id] ?? c.Hex ?? "";
              const swatch = resolveSwatch(c.Name, draft || c.Hex);
              return (
                <tr key={c.Id} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3">
                    <span
                      className="inline-block w-7 h-7 rounded-full border border-gray-300 dark:border-gray-600"
                      style={
                        swatch.hex
                          ? { backgroundColor: swatch.hex }
                          : { backgroundImage: "linear-gradient(135deg,#e5e7eb 0 50%,#9ca3af 50% 100%)" }
                      }
                    />
                  </td>
                  <td className="p-3 font-medium">{c.Name}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={swatch.hex || "#888888"}
                        onChange={(e) => setDrafts((d) => ({ ...d, [c.Id]: e.target.value }))}
                        className="w-9 h-9 rounded cursor-pointer bg-transparent border border-gray-300 dark:border-gray-600"
                      />
                      <input
                        value={draft}
                        placeholder="auto"
                        onChange={(e) => setDrafts((d) => ({ ...d, [c.Id]: e.target.value }))}
                        className="w-28 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm"
                      />
                    </div>
                  </td>
                  <td className="p-3 text-right text-gray-500 dark:text-gray-400">{c.UsageCount}</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => save(c)}
                      disabled={savingId === c.Id}
                      className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
                    >
                      {savingId === c.Id ? "..." : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Products ---------------- */

function ProductsTable({ products, reload }: { products: CatalogProduct[]; reload: () => void }) {
  const [editId, setEditId] = useState<string | null>(null);

  async function quickToggle(p: CatalogProduct, field: "IsActive" | "IsFeatured" | "IsNewArrival" | "IsDtfPrintable") {
    try {
      await toggleProductFlag(p.Id, field, !p[field]);
      reload();
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {products.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No products. Add products in the Stocks page first.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 dark:bg-gray-700/50">
              <tr>
                <th className="p-3 text-left font-semibold">Image</th>
                <th className="p-3 text-left font-semibold">Name</th>
                <th className="p-3 text-left font-semibold">Category</th>
                <th className="p-3 text-right font-semibold">Price</th>
                <th className="p-3 text-right font-semibold">Stock</th>
                <th className="p-3 text-center font-semibold">Active</th>
                <th className="p-3 text-center font-semibold">Featured</th>
                <th className="p-3 text-center font-semibold">New</th>
                <th className="p-3 text-center font-semibold">DTF</th>
                <th className="p-3 text-center font-semibold">Edit</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const onSale = p.CompareAtPrice && p.CompareAtPrice > p.SellingPrice;
                return (
                  <tr key={p.Id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="p-3">
                      {p.ImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.ImageUrl} alt={p.Name} className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                          <ImagePlus className="w-5 h-5" />
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-medium">
                      {p.Name}
                      {onSale && <span className="ml-2 text-xs bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded">SALE</span>}
                      {p.BlankProductId && <span className="ml-2 text-xs bg-gray-100 text-gray-500 dark:bg-gray-700 px-2 py-0.5 rounded" title="Shares stock from this blank">↳ {p.BlankName}</span>}
                      {p.PrintOnDemand && <span className="ml-2 text-xs bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded">POD</span>}
                    </td>
                    <td className="p-3 text-gray-600 dark:text-gray-400">{p.CategoryName || "-"}</td>
                    <td className="p-3 text-right">
                      <span className="font-semibold">{money(p.SellingPrice)}</span>
                      {onSale && <span className="block text-xs text-gray-400 line-through">{money(p.CompareAtPrice!)}</span>}
                    </td>
                    <td className="p-3 text-right text-gray-600 dark:text-gray-400">{p.Stock}</td>
                    <td className="p-3 text-center">
                      <button onClick={() => quickToggle(p, "IsActive")} title="Toggle visible on website">
                        {p.IsActive ? <Eye className="w-5 h-5 text-green-500 mx-auto" /> : <EyeOff className="w-5 h-5 text-gray-400 mx-auto" />}
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => quickToggle(p, "IsFeatured")} title="Toggle featured">
                        <Star className={`w-5 h-5 mx-auto ${p.IsFeatured ? "text-yellow-400 fill-yellow-400" : "text-gray-400"}`} />
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => quickToggle(p, "IsNewArrival")} title="Toggle new arrival (shows in the homepage New Collection slider)">
                        <Sparkles className={`w-5 h-5 mx-auto ${p.IsNewArrival ? "text-primary fill-primary/30" : "text-gray-400"}`} />
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => quickToggle(p, "IsDtfPrintable")} title="Toggle DTF printable (shows on the customer Customize page)">
                        <Printer className={`w-5 h-5 mx-auto ${p.IsDtfPrintable ? "text-primary" : "text-gray-400"}`} />
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => setEditId(p.Id)} className="text-blue-500 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editId && (
        <ProductEditModal
          id={editId}
          onClose={() => setEditId(null)}
          onSaved={() => { setEditId(null); reload(); }}
        />
      )}
    </div>
  );
}

function ProductEditModal({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [sellingPrice, setSellingPrice] = useState(0);
  const [compareAt, setCompareAt] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isNewArrival, setIsNewArrival] = useState(false);
  const [isDtfPrintable, setIsDtfPrintable] = useState(false);
  const [blankProductId, setBlankProductId] = useState<string>("");
  const [dtfProfit, setDtfProfit] = useState<string>("");
  const [printOnDemand, setPrintOnDemand] = useState(false);
  const [sizeChartUrl, setSizeChartUrl] = useState<string>("");
  const [uploadingChart, setUploadingChart] = useState(false);
  const [selectByImage, setSelectByImage] = useState(false);
  const [designs, setDesigns] = useState<{ imageId?: string; url: string; qty: string }[]>([]);
  const [uploadingDesign, setUploadingDesign] = useState(false);
  const [blankCandidates, setBlankCandidates] = useState<{ Id: string; Name: string }[]>([]);
  const [sortOrder, setSortOrder] = useState(0);
  const [images, setImages] = useState<ImgItem[]>([]);
  const [productColors, setProductColors] = useState<{ Id: string; Name: string; Hex: string | null }[]>([]);
  const [uploadingGroup, setUploadingGroup] = useState<string | null>(null); // colorId or "__all__"

  useEffect(() => {
    (async () => {
      try {
        const { product, images, colors } = await getProductForEdit(id);
        if (!product) throw new Error("Product not found");
        setName(product.Name);
        setSlug(product.Slug || "");
        setDescription(product.Description || "");
        setSellingPrice(product.SellingPrice);
        setCompareAt(product.CompareAtPrice != null ? String(product.CompareAtPrice) : "");
        setIsActive(!!product.IsActive);
        setIsFeatured(!!product.IsFeatured);
        setIsNewArrival(!!product.IsNewArrival);
        setIsDtfPrintable(!!product.IsDtfPrintable);
        setBlankProductId(product.BlankProductId || "");
        setDtfProfit(product.DtfProfit != null ? String(product.DtfProfit) : "");
        setPrintOnDemand(!!product.PrintOnDemand);
        setSizeChartUrl(product.SizeChartUrl || "");
        setSelectByImage(!!product.SelectByImage);
        if (product.SelectByImage) {
          getProductDesigns(id)
            .then((rows) => setDesigns(rows.map((r) => ({ imageId: r.ImageId, url: r.Url, qty: String(r.Qty ?? 0) }))))
            .catch(() => {});
        }
        getBlankCandidates(id).then(setBlankCandidates).catch(() => {});
        setSortOrder(product.SortOrder || 0);
        const cols = colors || [];
        setProductColors(cols);
        const loaded: ImgItem[] = images.map((i: any) => ({ url: i.Url, colorId: i.ColorId || null }));
        // Coloured products have no "general" bucket — drop any legacy null-colour images.
        setImages(cols.length > 0 ? loaded.filter((im) => im.colorId !== null) : loaded);
      } catch (err: any) {
        toast.error(err.message || "Load failed");
        onClose();
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function onUpload(files: FileList | null, colorId: string | null) {
    if (!files?.length) return;
    setUploadingGroup(colorId ?? "__all__");
    try {
      const added: ImgItem[] = [];
      for (const f of Array.from(files)) added.push({ url: await uploadFile(f, "products"), colorId });
      setImages((prev) => [...prev, ...added]);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingGroup(null);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onUploadDesigns(files: FileList | null) {
    if (!files?.length) return;
    setUploadingDesign(true);
    try {
      const added: { url: string; qty: string }[] = [];
      for (const f of Array.from(files)) added.push({ url: await uploadFile(f, "products"), qty: "1" });
      setDesigns((prev) => [...prev, ...added]);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingDesign(false);
    }
  }

  async function onUploadChart(file: File | null) {
    if (!file) return;
    setUploadingChart(true);
    try {
      setSizeChartUrl(await uploadFile(file, "products"));
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingChart(false);
    }
  }

  // Move an image up/down within its own colour group (swap with same-group neighbour).
  function move(globalIndex: number, dir: -1 | 1) {
    setImages((prev) => {
      const arr = [...prev];
      const cid = arr[globalIndex].colorId;
      let j = globalIndex + dir;
      while (j >= 0 && j < arr.length && arr[j].colorId !== cid) j += dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[globalIndex], arr[j]] = [arr[j], arr[globalIndex]];
      return arr;
    });
  }

  function removeAt(globalIndex: number) {
    setImages((prev) => prev.filter((_, k) => k !== globalIndex));
  }

  async function save() {
    setSaving(true);
    try {
      const compareVal = compareAt.trim() === "" ? null : Number(compareAt);
      if (compareVal != null && compareVal <= sellingPrice) {
        toast.error("Cut price must be higher than the selling price.");
        setSaving(false);
        return;
      }
      await updateProductStorefront(id, {
        name, slug, description: description || null,
        compareAtPrice: compareVal, isActive, isFeatured, isNewArrival, isDtfPrintable,
        blankProductId: blankProductId || null,
        dtfProfit: dtfProfit.trim() === "" ? null : Number(dtfProfit),
        printOnDemand,
        sizeChartUrl: sizeChartUrl || null,
        selectByImage,
        sortOrder,
      });
      if (selectByImage) {
        await saveDesigns(id, designs.map((d) => ({ imageId: d.imageId, url: d.url, qty: Number(d.qty) || 0 })));
      } else {
        await setProductImages(id, images);
      }
      toast.success("Product saved");
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-bold flex items-center gap-2"><Edit3 className="w-5 h-5 text-primary" /> Edit storefront product</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5" />
              <p className="text-xs text-gray-400 mt-1">Price & stock are managed in the Stocks page. Selling price: <b>{money(sellingPrice)}</b></p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">URL slug</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated if empty" className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Shown on the product page" className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cut price (compare-at)</label>
                <input value={compareAt} onChange={(e) => setCompareAt(e.target.value)} type="number" placeholder="optional" className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5" />
                <p className="text-xs text-gray-400 mt-1">Higher than selling price → shown struck-through.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sort order</label>
                <input value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} type="number" className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5" />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Visible on website</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} /> Featured</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isNewArrival} onChange={(e) => setIsNewArrival(e.target.checked)} /> New arrival</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isDtfPrintable} onChange={(e) => setIsDtfPrintable(e.target.checked)} /> DTF printable</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={printOnDemand} onChange={(e) => setPrintOnDemand(e.target.checked)} /> Print on demand</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={selectByImage} onChange={(e) => setSelectByImage(e.target.checked)} /> Select by image (designs)</label>
            </div>

            {/* Shared stock + DTF profit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Stock source (blank)</label>
                <select
                  value={blankProductId}
                  onChange={(e) => setBlankProductId(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5"
                >
                  <option value="">— Own stock —</option>
                  {blankCandidates.map((b) => (
                    <option key={b.Id} value={b.Id}>{b.Name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Link to a blank to share its stock (this product won&apos;t hold its own).</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">DTF profit (Rs)</label>
                <input value={dtfProfit} onChange={(e) => setDtfProfit(e.target.value)} type="number" placeholder="global default" className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5" />
                <p className="text-xs text-gray-400 mt-1">Added on the blank cost when DTF-printed. Empty = global default.</p>
              </div>
            </div>

            {/* Size chart */}
            <div>
              <label className="block text-sm font-medium mb-1">Size chart</label>
              <p className="text-xs text-gray-400 mb-2">Optional image shown on the product page — customers open it in a popup.</p>
              <div className="flex items-center gap-3">
                {sizeChartUrl ? (
                  <div className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sizeChartUrl} alt="size chart" className="w-20 h-20 rounded-lg object-cover border border-gray-300 dark:border-gray-600" />
                    <button onClick={() => setSizeChartUrl("")} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-primary text-gray-400 hover:text-primary">
                    {uploadingChart ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-primary" /> : <ImagePlus className="w-6 h-6" />}
                    <input type="file" accept="image/*" hidden onChange={(e) => onUploadChart(e.target.files?.[0] || null)} />
                  </label>
                )}
              </div>
            </div>

            {/* Designs manager — each image is a selectable design with its own stock */}
            {selectByImage && (
              <div className="space-y-3">
                <label className="block text-sm font-medium">Designs</label>
                <p className="text-xs text-gray-400 -mt-1">Each image is a design the customer picks. Set the stock qty per design.</p>
                <div className="flex flex-wrap gap-3">
                  {designs.map((d, i) => (
                    <div key={(d.imageId || "new") + i} className="w-28 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.url} alt="" className="w-full h-24 object-cover rounded" />
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] text-gray-400">Qty</span>
                        <input
                          type="number"
                          min={0}
                          value={d.qty}
                          onChange={(e) => setDesigns((prev) => prev.map((x, k) => (k === i ? { ...x, qty: e.target.value } : x)))}
                          className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded px-1 py-0.5 text-xs"
                        />
                        <button onClick={() => setDesigns((prev) => prev.filter((_, k) => k !== i))} className="text-red-500 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <label className="w-28 h-[7.5rem] rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-primary text-gray-400 hover:text-primary">
                    {uploadingDesign ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-primary" /> : <ImagePlus className="w-6 h-6" />}
                    <input type="file" accept="image/*" multiple hidden onChange={(e) => onUploadDesigns(e.target.files)} />
                  </label>
                </div>
              </div>
            )}

            {/* Images grouped by colour */}
            {!selectByImage && (
            <div className="space-y-4">
              <label className="block text-sm font-medium">Images</label>
              <p className="text-xs text-gray-400 -mt-2">
                Add <b>4 images per colour</b> — they show as a grid on the product page, and the card
                image changes when the customer picks that colour. The very first image is the main thumbnail.
              </p>

              {(productColors.length > 0
                ? productColors.map((c) => ({ key: c.Id, label: c.Name, colorId: c.Id as string | null, hex: c.Hex }))
                : [{ key: "__all__", label: "Product images", colorId: null as string | null, hex: null as string | null }]
              ).map((grp) => {
                const items = images
                  .map((im, gi) => ({ im, gi }))
                  .filter((x) => (x.im.colorId || null) === grp.colorId);
                const isUploading = uploadingGroup === (grp.colorId ?? "__all__");
                return (
                  <div key={grp.key} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {grp.colorId && (
                        <span
                          className="inline-block w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                          style={resolveSwatch(grp.label, grp.hex).hex
                            ? { backgroundColor: resolveSwatch(grp.label, grp.hex).hex! }
                            : { backgroundImage: "linear-gradient(135deg,#e5e7eb 0 50%,#9ca3af 50% 100%)" }}
                        />
                      )}
                      <span className="text-sm font-medium">{grp.label}</span>
                      <span className="text-xs text-gray-400">({items.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {items.map(({ im, gi }) => (
                        <div key={im.url + gi} className="relative group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={im.url} alt="" className="w-20 h-20 rounded-lg object-cover border border-gray-300 dark:border-gray-600" />
                          {gi === 0 && <span className="absolute top-1 left-1 text-[10px] bg-primary text-white px-1 rounded">MAIN</span>}
                          <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 rounded-b-lg opacity-0 group-hover:opacity-100 transition">
                            <button onClick={() => move(gi, -1)} className="text-white text-xs px-1">◀</button>
                            <button onClick={() => removeAt(gi)} className="text-white text-xs px-1"><Trash2 className="w-3 h-3" /></button>
                            <button onClick={() => move(gi, 1)} className="text-white text-xs px-1">▶</button>
                          </div>
                        </div>
                      ))}
                      <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-primary text-gray-400 hover:text-primary">
                        {isUploading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-primary" /> : <ImagePlus className="w-6 h-6" />}
                        <input type="file" accept="image/*" multiple hidden onChange={(e) => onUpload(e.target.files, grp.colorId)} />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <button onClick={onClose} className="px-5 py-2.5 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90 px-6 py-2.5 rounded-lg font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Categories ---------------- */

function CategoriesTable({ categories, reload }: { categories: CatalogCategory[]; reload: () => void }) {
  const [edit, setEdit] = useState<CatalogCategory | null>(null);

  return (
    <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {categories.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">No categories.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 dark:bg-gray-700/50">
              <tr>
                <th className="p-3 text-left font-semibold">Image</th>
                <th className="p-3 text-left font-semibold">Name</th>
                <th className="p-3 text-left font-semibold">Slug</th>
                <th className="p-3 text-right font-semibold">Products</th>
                <th className="p-3 text-center font-semibold">Active</th>
                <th className="p-3 text-center font-semibold">Edit</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.Id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="p-3">
                    {c.ImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.ImageUrl} alt={c.Name} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400"><ImagePlus className="w-5 h-5" /></div>
                    )}
                  </td>
                  <td className="p-3 font-medium">{c.Name}</td>
                  <td className="p-3 text-gray-500 dark:text-gray-400 text-sm">{c.Slug}</td>
                  <td className="p-3 text-right text-gray-600 dark:text-gray-400">{c.ProductCount}</td>
                  <td className="p-3 text-center">{c.IsActive ? <Eye className="w-5 h-5 text-green-500 mx-auto" /> : <EyeOff className="w-5 h-5 text-gray-400 mx-auto" />}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => setEdit(c)} className="text-blue-500 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"><Edit3 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit && <CategoryEditModal category={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

function CategoryEditModal({ category, onClose, onSaved }: { category: CatalogCategory; onClose: () => void; onSaved: () => void }) {
  const [slug, setSlug] = useState(category.Slug || "");
  const [description, setDescription] = useState(category.Description || "");
  const [imageUrl, setImageUrl] = useState(category.ImageUrl || "");
  const [isActive, setIsActive] = useState(!!category.IsActive);
  const [sortOrder, setSortOrder] = useState(category.SortOrder || 0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function onUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      setImageUrl(await uploadFile(file, "categories"));
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await updateCategoryStorefront(category.Id, {
        name: category.Name, slug, imageUrl: imageUrl || null,
        description: description || null, isActive, sortOrder,
      });
      toast.success("Category saved");
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold flex items-center gap-2"><Edit3 className="w-5 h-5 text-primary" /> {category.Name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="w-20 h-20 rounded-lg object-cover border border-gray-300 dark:border-gray-600" />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400"><ImagePlus className="w-6 h-6" /></div>
            )}
            <label className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 cursor-pointer text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600">
              {uploading ? "Uploading..." : "Upload image"}
              <input type="file" accept="image/*" hidden onChange={(e) => onUpload(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">URL slug</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto if empty" className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Sort order</label>
              <input value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} type="number" className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pb-2.5"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Visible</label>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
            <button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90 px-6 py-2.5 rounded-lg font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
