"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { MessageSquareQuote, Save, Trash2, ImagePlus, Pencil, X } from "lucide-react";
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
  const [confirmDelete, setConfirmDelete] = useState<AdminFeedbackItem | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    setDeleting(true);
    try {
      await deleteFeedbackItem(id);
      toast.success("Feedback item deleted");
      if (edit?.id === id) setEdit(null);
      setConfirmDelete(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setDeleting(false);
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

      {/* Edit modal (large) */}
      {edit && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4" onClick={() => setEdit(null)} role="dialog" aria-modal="true">
        <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold">Edit feedback item</h2>
            <button onClick={() => setEdit(null)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-wrap items-start gap-5">
            <div className="w-40 max-h-72 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={edit.imageUrl} alt="" className="w-full h-auto object-contain" />
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
                  <button onClick={() => setConfirmDelete(f)} className="p-2 text-gray-400 hover:text-red-500" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation (styled, replaces the browser alert) */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)} role="dialog" aria-modal="true">
          <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/15 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold">Delete feedback screenshot?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {confirmDelete.CustomerName ? `${confirmDelete.CustomerName}'s screenshot` : "This screenshot"} will be removed from the website. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium">
                Cancel
              </button>
              <button
                onClick={() => remove(confirmDelete.Id)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
