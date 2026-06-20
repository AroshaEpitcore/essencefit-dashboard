"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { getStoreSettings, saveStoreSettings } from "../settings/actions";
import type { StoreSettings, HeroSlide } from "@/lib/storeSettings";
import { Globe, Save, ImagePlus, Plus, Trash2, Landmark, Truck, Phone, Share2 } from "lucide-react";

async function uploadFile(file: File, folder: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.url as string;
}

const input = "w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white";
const card = "bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4";

export default function StoreSettingsPage() {
  const [s, setS] = useState<StoreSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getStoreSettings().then(setS).catch((e) => toast.error(e.message || "Load failed"));
  }, []);

  function set<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) {
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    try {
      await saveStoreSettings(s);
      toast.success("Store settings saved");
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File | null) {
    if (!file || !s) return;
    try {
      set("logo", await uploadFile(file, "store"));
      toast.success("Logo uploaded (remember to Save)");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    }
  }

  async function addSlide(file: File | null) {
    if (!file || !s) return;
    try {
      const url = await uploadFile(file, "store");
      set("heroSlides", [...s.heroSlides, { image: url, title: "", subtitle: "", link: "" }]);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    }
  }

  function updateSlide(i: number, patch: Partial<HeroSlide>) {
    if (!s) return;
    set("heroSlides", s.heroSlides.map((sl, k) => (k === i ? { ...sl, ...patch } : sl)));
  }

  if (!s) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="text-gray-900 dark:text-white max-w-4xl">
      <Toaster position="top-right" />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-3 rounded-lg"><Globe className="w-6 h-6 text-primary" /></div>
          <h1 className="text-xl font-bold">Store / Website Settings</h1>
        </div>
        <button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-semibold disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save All"}
        </button>
      </div>

      <div className="space-y-6">
        {/* Brand */}
        <div className={card}>
          <h2 className="font-semibold flex items-center gap-2"><ImagePlus className="w-4 h-4 text-primary" /> Brand</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Store name</label>
            <input value={s.storeName} onChange={(e) => set("storeName", e.target.value)} className={input} />
          </div>
          <div className="flex items-center gap-4">
            {s.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logo} alt="logo" className="h-14 rounded-lg bg-gray-100 dark:bg-gray-900 object-contain px-2" />
            ) : (
              <div className="h-14 w-14 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400"><ImagePlus className="w-6 h-6" /></div>
            )}
            <label className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 cursor-pointer text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600">
              Upload logo
              <input type="file" accept="image/*" hidden onChange={(e) => uploadLogo(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Announcement bar text</label>
            <input value={s.announcement} onChange={(e) => set("announcement", e.target.value)} className={input} />
          </div>
        </div>

        {/* Hero slides */}
        <div className={card}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><ImagePlus className="w-4 h-4 text-primary" /> Hero banners</h2>
            <label className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 cursor-pointer text-sm font-medium flex items-center gap-1 hover:bg-gray-200 dark:hover:bg-gray-600">
              <Plus className="w-4 h-4" /> Add slide
              <input type="file" accept="image/*" hidden onChange={(e) => addSlide(e.target.files?.[0] || null)} />
            </label>
          </div>
          {s.heroSlides.length === 0 && <p className="text-sm text-gray-400">No banners yet. Add one for the homepage hero.</p>}
          {s.heroSlides.map((sl, i) => (
            <div key={i} className="flex gap-3 items-start border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sl.image} alt="" className="w-28 h-20 rounded object-cover" />
              <div className="flex-1 space-y-2">
                <input value={sl.title} onChange={(e) => updateSlide(i, { title: e.target.value })} placeholder="Title" className={input} />
                <input value={sl.subtitle} onChange={(e) => updateSlide(i, { subtitle: e.target.value })} placeholder="Subtitle" className={input} />
                <input value={sl.link} onChange={(e) => updateSlide(i, { link: e.target.value })} placeholder="Link (e.g. /category/t-shirts)" className={input} />
              </div>
              <button onClick={() => set("heroSlides", s.heroSlides.filter((_, k) => k !== i))} className="text-red-500 hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        {/* Delivery */}
        <div className={card}>
          <h2 className="font-semibold flex items-center gap-2"><Truck className="w-4 h-4 text-primary" /> Delivery</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Delivery fee (Rs.)</label>
              <input type="number" value={s.deliveryFee} onChange={(e) => set("deliveryFee", Number(e.target.value) || 0)} className={input} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Free delivery over (Rs., 0 = off)</label>
              <input type="number" value={s.freeDeliveryOver} onChange={(e) => set("freeDeliveryOver", Number(e.target.value) || 0)} className={input} />
            </div>
          </div>
        </div>

        {/* Bank */}
        <div className={card}>
          <h2 className="font-semibold flex items-center gap-2"><Landmark className="w-4 h-4 text-primary" /> Bank transfer details</h2>
          <div className="grid grid-cols-2 gap-4">
            <input value={s.bank.bank} onChange={(e) => set("bank", { ...s.bank, bank: e.target.value })} placeholder="Bank" className={input} />
            <input value={s.bank.branch} onChange={(e) => set("bank", { ...s.bank, branch: e.target.value })} placeholder="Branch" className={input} />
            <input value={s.bank.accountName} onChange={(e) => set("bank", { ...s.bank, accountName: e.target.value })} placeholder="Account name" className={input} />
            <input value={s.bank.accountNo} onChange={(e) => set("bank", { ...s.bank, accountNo: e.target.value })} placeholder="Account number" className={input} />
          </div>
        </div>

        {/* Contact + social */}
        <div className={card}>
          <h2 className="font-semibold flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> Contact</h2>
          <div className="grid grid-cols-2 gap-4">
            <input value={s.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="Contact phone" className={input} />
            <input value={s.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder="Contact email" className={input} />
          </div>
          <h2 className="font-semibold flex items-center gap-2 pt-2"><Share2 className="w-4 h-4 text-primary" /> Social links</h2>
          <div className="grid grid-cols-2 gap-4">
            <input value={s.social.facebook} onChange={(e) => set("social", { ...s.social, facebook: e.target.value })} placeholder="Facebook URL" className={input} />
            <input value={s.social.instagram} onChange={(e) => set("social", { ...s.social, instagram: e.target.value })} placeholder="Instagram URL" className={input} />
            <input value={s.social.whatsapp} onChange={(e) => set("social", { ...s.social, whatsapp: e.target.value })} placeholder="WhatsApp number" className={input} />
            <input value={s.social.tiktok} onChange={(e) => set("social", { ...s.social, tiktok: e.target.value })} placeholder="TikTok URL" className={input} />
          </div>
        </div>
      </div>
    </div>
  );
}
