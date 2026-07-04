"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Images, Save, Plus, Trash2, ImagePlus, X, Pencil, Star } from "lucide-react";
import {
  getAdminGalleryItems,
  getGalleryItemForEdit,
  saveGalleryItem,
  deleteGalleryItem,
  type AdminGalleryItem,
} from "./actions";

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", "gallery");
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
  customerName: string;
  artworkUrl: string | null;
  caption: string;
  isFeatured: boolean;
  isPublished: boolean;
  sortOrder: number;
  images: string[];
};

const EMPTY: FormState = {
  id: null,
  customerName: "",
  artworkUrl: null,
  caption: "",
  isFeatured: false,
  isPublished: true,
  sortOrder: 0,
  images: [],
};

export default function GalleryAdminPage() {
  const [items, setItems] = useState<AdminGalleryItem[]>([]);
  const [f, setF] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingArtwork, setUploadingArtwork] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  async function refresh() {
    setItems(await getAdminGalleryItems());
  }

  useEffect(() => {
    getAdminGalleryItems()
      .then(setItems)
      .catch((e) => toast.error(e.message || "Load failed"))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setF(EMPTY);
  }

  async function onArtwork(file: File | null) {
    if (!file) return;
    setUploadingArtwork(true);
    try {
      set("artworkUrl", await uploadFile(file));
      toast.success("Artwork uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploadingArtwork(false);
    }
  }

  async function onImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingImages(true);
    try {
      const urls = await Promise.all(Array.from(files).map((file) => uploadFile(file)));
      setF((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
      toast.success(`${urls.length} image${urls.length > 1 ? "s" : ""} added`);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploadingImages(false);
    }
  }

  async function edit(id: string) {
    try {
      const g = await getGalleryItemForEdit(id);
      if (!g) return toast.error("Gallery item not found");
      setF({
        id: g.Id,
        customerName: g.CustomerName,
        artworkUrl: g.ArtworkUrl,
        caption: g.Caption || "",
        isFeatured: g.IsFeatured,
        isPublished: g.IsPublished,
        sortOrder: g.SortOrder,
        images: g.Images,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      toast.error(e.message || "Load failed");
    }
  }

  async function save() {
    setSaving(true);
    try {
      await saveGalleryItem({
        id: f.id,
        customerName: f.customerName,
        artworkUrl: f.artworkUrl,
        caption: f.caption,
        isFeatured: f.isFeatured,
        isPublished: f.isPublished,
        sortOrder: f.sortOrder,
        images: f.images,
      });
      toast.success(f.id ? "Gallery item updated" : "Gallery item added");
      resetForm();
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this gallery item?")) return;
    try {
      await deleteGalleryItem(id);
      toast.success("Gallery item deleted");
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
        <Images className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Custom Orders Gallery</h1>
      </div>

      {/* Editor */}
      <div className={card}>
        <h2 className="font-semibold mb-4">{f.id ? "Edit gallery item" : "Add a gallery item"}</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Customer name *</label>
            <input className={input} value={f.customerName} onChange={(e) => set("customerName", e.target.value)} placeholder="e.g. Nimal P." />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={f.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} />
              Featured
            </label>
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
            <label className="block text-sm font-medium mb-1">Caption <span className="text-gray-400">(optional)</span></label>
            <textarea className={`${input} resize-y`} rows={2} value={f.caption} onChange={(e) => set("caption", e.target.value)} placeholder="A short note about this order…" />
          </div>

          {/* Customer's artwork */}
          <div>
            <label className="block text-sm font-medium mb-1">Customer&apos;s artwork <span className="text-gray-400">(optional)</span></label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                {f.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.artworkUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-500">N/A</span>
                )}
              </div>
              <label className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 cursor-pointer text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2">
                <ImagePlus className="w-4 h-4" /> {uploadingArtwork ? "Uploading…" : "Upload"}
                <input type="file" accept="image/*" hidden onChange={(e) => onArtwork(e.target.files?.[0] || null)} />
              </label>
              {f.artworkUrl && (
                <button type="button" onClick={() => set("artworkUrl", null)} className="text-gray-400 hover:text-red-500" aria-label="Remove artwork">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Final product images */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Final product photos * <span className="text-gray-400">(multiple)</span></label>
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
                {uploadingImages ? <span className="text-[10px]">…</span> : <Plus className="w-5 h-5" />}
                <input type="file" accept="image/*" multiple hidden onChange={(e) => onImages(e.target.files)} />
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-lg bg-primary text-white font-semibold flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? "Saving…" : f.id ? "Update item" : "Add item"}
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
        <h2 className="font-semibold mb-4">All gallery items ({items.length})</h2>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-gray-400 text-sm">No gallery items yet. Add one above.</p>
        ) : (
          <div className="space-y-3">
            {items.map((g) => (
              <div key={g.Id} className="flex items-start gap-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {g.ArtworkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.ArtworkUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    g.CustomerName.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{g.CustomerName}</span>
                    {g.IsFeatured && <Star className="w-4 h-4 fill-amber-400 text-amber-400" />}
                    {!g.IsPublished && <span className="text-[10px] uppercase tracking-wide bg-gray-200 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">Hidden</span>}
                  </div>
                  {g.Caption && <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{g.Caption}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {g.ImageCount} photo{g.ImageCount !== 1 ? "s" : ""}{g.ArtworkUrl ? " · artwork attached" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => edit(g.Id)} className="p-2 text-gray-400 hover:text-primary" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(g.Id)} className="p-2 text-gray-400 hover:text-red-500" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
