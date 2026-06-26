"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Star, Save, Plus, Trash2, ImagePlus, X, Pencil } from "lucide-react";
import {
  getAdminReviews,
  getReviewForEdit,
  getReviewProductOptions,
  saveReview,
  deleteReview,
  type AdminReview,
  type ReviewProductOption,
} from "./actions";

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", "reviews");
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.url as string;
}

const input =
  "w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white";
const card = "bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5";

type FormState = {
  id: string | null;
  productId: string;
  customerName: string;
  customerImage: string | null;
  rating: number;
  message: string;
  isPublished: boolean;
  sortOrder: number;
  images: string[];
};

const EMPTY: FormState = {
  id: null,
  productId: "",
  customerName: "",
  customerImage: null,
  rating: 5,
  message: "",
  isPublished: true,
  sortOrder: 0,
  images: [],
};

function Stars({ value, onChange, size = "md" }: { value: number; onChange?: (n: number) => void; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={onChange ? () => onChange(n) : undefined}
          className={onChange ? "cursor-pointer" : "cursor-default"}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star className={`${cls} ${n <= value ? "fill-amber-400 text-amber-400" : "text-gray-400"}`} />
        </button>
      ))}
    </div>
  );
}

export default function ReviewsAdminPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [products, setProducts] = useState<ReviewProductOption[]>([]);
  const [f, setF] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  async function refresh() {
    setReviews(await getAdminReviews());
  }

  useEffect(() => {
    Promise.all([getAdminReviews(), getReviewProductOptions()])
      .then(([r, p]) => {
        setReviews(r);
        setProducts(p);
      })
      .catch((e) => toast.error(e.message || "Load failed"))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setF(EMPTY);
  }

  async function onAvatar(file: File | null) {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      set("customerImage", await uploadFile(file));
      toast.success("Photo uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function onGallery(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingGallery(true);
    try {
      const urls = await Promise.all(Array.from(files).map((file) => uploadFile(file)));
      setF((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
      toast.success(`${urls.length} image${urls.length > 1 ? "s" : ""} added`);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploadingGallery(false);
    }
  }

  async function edit(id: string) {
    try {
      const r = await getReviewForEdit(id);
      if (!r) return toast.error("Review not found");
      setF({
        id: r.Id,
        productId: r.ProductId,
        customerName: r.CustomerName,
        customerImage: r.CustomerImage,
        rating: r.Rating,
        message: r.Message,
        isPublished: r.IsPublished,
        sortOrder: r.SortOrder,
        images: r.Images,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      toast.error(e.message || "Load failed");
    }
  }

  async function save() {
    setSaving(true);
    try {
      await saveReview({
        id: f.id,
        productId: f.productId,
        customerName: f.customerName,
        customerImage: f.customerImage,
        rating: f.rating,
        message: f.message,
        isPublished: f.isPublished,
        sortOrder: f.sortOrder,
        images: f.images,
      });
      toast.success(f.id ? "Review updated" : "Review added");
      resetForm();
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this review?")) return;
    try {
      await deleteReview(id);
      toast.success("Review deleted");
      if (f.id === id) resetForm();
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Toaster position="top-center" />

      <div className="flex items-center gap-2">
        <Star className="w-6 h-6 text-amber-400" />
        <h1 className="text-2xl font-bold">Customer Reviews</h1>
      </div>

      {/* Editor */}
      <div className={card}>
        <h2 className="font-semibold mb-4">{f.id ? "Edit review" : "Add a review"}</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Product *</label>
            <select className={input} value={f.productId} onChange={(e) => set("productId", e.target.value)}>
              <option value="">Select a product…</option>
              {products.map((p) => (
                <option key={p.Id} value={p.Id}>
                  {p.Name}
                  {p.CategoryName ? ` — ${p.CategoryName}` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">The category is derived from the product automatically.</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Customer name *</label>
            <input className={input} value={f.customerName} onChange={(e) => set("customerName", e.target.value)} placeholder="e.g. Nimal P." />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Rating</label>
            <Stars value={f.rating} onChange={(n) => set("rating", n)} />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={f.isPublished} onChange={(e) => set("isPublished", e.target.checked)} />
              Published
            </label>
            <div>
              <label className="block text-sm font-medium mb-1">Sort order</label>
              <input type="number" className={`${input} w-28`} value={f.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Review message *</label>
            <textarea className={`${input} resize-y`} rows={3} value={f.message} onChange={(e) => set("message", e.target.value)} placeholder="What the customer said…" />
          </div>

          {/* Avatar */}
          <div>
            <label className="block text-sm font-medium mb-1">Customer photo <span className="text-gray-400">(optional — initials shown if empty)</span></label>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                {f.customerImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.customerImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-500">N/A</span>
                )}
              </div>
              <label className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 cursor-pointer text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2">
                <ImagePlus className="w-4 h-4" /> {uploadingAvatar ? "Uploading…" : "Upload"}
                <input type="file" accept="image/*" hidden onChange={(e) => onAvatar(e.target.files?.[0] || null)} />
              </label>
              {f.customerImage && (
                <button type="button" onClick={() => set("customerImage", null)} className="text-gray-400 hover:text-red-500" aria-label="Remove photo">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Gallery */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Review photos <span className="text-gray-400">(optional, multiple)</span></label>
            <div className="flex flex-wrap items-center gap-3">
              {f.images.map((url, i) => (
                <div key={url + i} className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setF((prev) => ({ ...prev, images: prev.images.filter((_, idx) => idx !== i) }))}
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                    aria-label="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-primary text-gray-400">
                {uploadingGallery ? <span className="text-[10px]">…</span> : <Plus className="w-5 h-5" />}
                <input type="file" accept="image/*" multiple hidden onChange={(e) => onGallery(e.target.files)} />
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-lg bg-primary text-white font-semibold flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? "Saving…" : f.id ? "Update review" : "Add review"}
          </button>
          {f.id && (
            <button onClick={resetForm} className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium">
              Cancel edit
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className={card}>
        <h2 className="font-semibold mb-4">All reviews ({reviews.length})</h2>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : reviews.length === 0 ? (
          <p className="text-gray-400 text-sm">No reviews yet. Add one above.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.Id} className="flex items-start gap-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {r.CustomerImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.CustomerImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    r.CustomerName.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.CustomerName}</span>
                    <Stars value={r.Rating} size="sm" />
                    {!r.IsPublished && <span className="text-[10px] uppercase tracking-wide bg-gray-200 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">Hidden</span>}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{r.Message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {r.ProductName || "—"}{r.ImageCount > 0 ? ` · ${r.ImageCount} photo${r.ImageCount > 1 ? "s" : ""}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => edit(r.Id)} className="p-2 text-gray-400 hover:text-primary" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(r.Id)} className="p-2 text-gray-400 hover:text-red-500" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
