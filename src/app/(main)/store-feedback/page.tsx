"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { MessageSquareQuote, Save, Trash2, ImagePlus, Pencil } from "lucide-react";
import {
  getAdminFeedbackItems,
  addFeedbackItems,
  saveFeedbackItem,
  deleteFeedbackItem,
  type AdminFeedbackItem,
} from "./actions";

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", "feedback");
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.url as string;
}

const input =
  "w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white";
const card = "bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5";

type EditState = {
  id: string;
  imageUrl: string;
  customerName: string;
  isPublished: boolean;
  sortOrder: number;
};

export default function FeedbackAdminPage() {
  const [items, setItems] = useState<AdminFeedbackItem[]>([]);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setItems(await getAdminFeedbackItems());
  }

  useEffect(() => {
    getAdminFeedbackItems()
      .then(setItems)
      .catch((e) => toast.error(e.message || "Load failed"))
      .finally(() => setLoading(false));
  }, []);

  // Bulk add: each selected screenshot becomes one published item.
  async function onAddScreenshots(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls = await Promise.all(Array.from(files).map((file) => uploadFile(file)));
      const { added } = await addFeedbackItems(urls);
      toast.success(`${added} screenshot${added > 1 ? "s" : ""} added`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function startEdit(f: AdminFeedbackItem) {
    setEdit({
      id: f.Id,
      imageUrl: f.ImageUrl,
      customerName: f.CustomerName || "",
      isPublished: f.IsPublished,
      sortOrder: f.SortOrder,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!edit) return;
    setSaving(true);
    try {
      await saveFeedbackItem({
        id: edit.id,
        customerName: edit.customerName,
        isPublished: edit.isPublished,
        sortOrder: edit.sortOrder,
      });
      toast.success("Feedback item updated");
      setEdit(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this feedback screenshot?")) return;
    try {
      await deleteFeedbackItem(id);
      toast.success("Feedback item deleted");
      if (edit?.id === id) setEdit(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Toaster position="top-center" />

      <div className="flex items-center gap-2">
        <MessageSquareQuote className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Customer Feedback</h1>
      </div>

      {/* Quick add — every selected screenshot becomes one published item */}
      <div className={card}>
        <h2 className="font-semibold mb-1">Add screenshots</h2>
        <p className="text-sm text-gray-400 mb-4">
          Select one or more feedback screenshots (WhatsApp chats etc.). Each becomes its own published item —
          you can add a customer name or hide items afterwards from the list below.
        </p>
        <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white font-semibold cursor-pointer hover:bg-primary/90">
          <ImagePlus className="w-4 h-4" /> {uploading ? "Uploading…" : "Upload screenshots"}
          <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={(e) => onAddScreenshots(e.target.files)} />
        </label>
      </div>

      {/* Inline editor (appears when editing an item) */}
      {edit && (
        <div className={card}>
          <h2 className="font-semibold mb-4">Edit feedback item</h2>
          <div className="flex flex-wrap items-start gap-5">
            <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={edit.imageUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-[240px] grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Customer name <span className="text-gray-400">(optional)</span></label>
                <input className={input} value={edit.customerName} onChange={(e) => setEdit({ ...edit, customerName: e.target.value })} placeholder="e.g. Nimal P." />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={edit.isPublished} onChange={(e) => setEdit({ ...edit, isPublished: e.target.checked })} />
                  Published
                </label>
                <div>
                  <label className="block text-sm font-medium mb-1">Sort order</label>
                  <input type="number" className={`${input} w-28`} value={edit.sortOrder} onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) || 0 })} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-5">
            <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-lg bg-primary text-white font-semibold flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? "Saving…" : "Update item"}
            </button>
            <button onClick={() => setEdit(null)} className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className={card}>
        <h2 className="font-semibold mb-4">All feedback ({items.length})</h2>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-gray-400 text-sm">No feedback screenshots yet. Upload some above.</p>
        ) : (
          <div className="space-y-3">
            {items.map((f) => (
              <div key={f.Id} className="flex items-center gap-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.ImageUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{f.CustomerName || "—"}</span>
                    {!f.IsPublished && <span className="text-[10px] uppercase tracking-wide bg-gray-200 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">Hidden</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Added {new Date(f.CreatedAt).toLocaleDateString()}{f.SortOrder ? ` · sort ${f.SortOrder}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(f)} className="p-2 text-gray-400 hover:text-primary" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(f.Id)} className="p-2 text-gray-400 hover:text-red-500" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
