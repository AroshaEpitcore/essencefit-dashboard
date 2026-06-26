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

  async function uploadLogo(which: "logoDark" | "logoLight", file: File | null) {
    if (!file || !s) return;
    try {
      set(which, await uploadFile(file, "store"));
      toast.success("Logo uploaded (remember to Save)");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    }
  }

  async function addSlide(file: File | null) {
    if (!file || !s) return;
    const type = file.type.startsWith("video") ? "video" : "image";
    try {
      const url = await uploadFile(file, "hero");
      set("heroSlides", [
        ...s.heroSlides,
        { type, src: url, heading: "", subheading: "", ctaText: "Shop now", ctaLink: "/shop", align: "center" },
      ]);
      toast.success(`${type === "video" ? "Video" : "Image"} slide added (remember to Save)`);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    }
  }

  function updateSlide(i: number, patch: Partial<HeroSlide>) {
    if (!s) return;
    set("heroSlides", s.heroSlides.map((sl, k) => (k === i ? { ...sl, ...patch } : sl)));
  }

  function moveSlide(i: number, dir: -1 | 1) {
    if (!s) return;
    const arr = [...s.heroSlides];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set("heroSlides", arr);
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
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Dark logo — shown on the solid white header */}
            <div>
              <p className="text-sm font-medium mb-1">Dark logo <span className="text-gray-400">(on white header)</span></p>
              <div className="flex items-center gap-3">
                <div className="h-14 w-24 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
                  {s.logoDark ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logoDark} alt="dark logo" className="h-12 object-contain" />
                  ) : <ImagePlus className="w-5 h-5 text-gray-400" />}
                </div>
                <label className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 cursor-pointer text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600">
                  Upload
                  <input type="file" accept="image/*" hidden onChange={(e) => uploadLogo("logoDark", e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>
            {/* Light logo — shown on the transparent header over the hero */}
            <div>
              <p className="text-sm font-medium mb-1">Light logo <span className="text-gray-400">(on transparent header)</span></p>
              <div className="flex items-center gap-3">
                <div className="h-14 w-24 rounded-lg bg-gray-800 flex items-center justify-center overflow-hidden">
                  {s.logoLight ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logoLight} alt="light logo" className="h-12 object-contain" />
                  ) : <ImagePlus className="w-5 h-5 text-gray-400" />}
                </div>
                <label className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 cursor-pointer text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600">
                  Upload
                  <input type="file" accept="image/*" hidden onChange={(e) => uploadLogo("logoLight", e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Top promo banner <span className="text-gray-400">(one message per line — they scroll as a marquee; leave empty to hide)</span></label>
            <textarea value={s.announcement} onChange={(e) => set("announcement", e.target.value)} rows={4} placeholder={"Free delivery on orders over Rs. 10,000\nIsland-wide cash on delivery\nNew arrivals every week"} className={`${input} resize-y`} />
          </div>
        </div>

        {/* Hero slides */}
        <div className={card}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold flex items-center gap-2"><ImagePlus className="w-4 h-4 text-primary" /> Hero slides</h2>
            <div className="flex gap-2">
              <label className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 cursor-pointer text-sm font-medium flex items-center gap-1 hover:bg-gray-200 dark:hover:bg-gray-600">
                <Plus className="w-4 h-4" /> Image
                <input type="file" accept="image/*" hidden onChange={(e) => addSlide(e.target.files?.[0] || null)} />
              </label>
              <label className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 cursor-pointer text-sm font-medium flex items-center gap-1 hover:bg-gray-200 dark:hover:bg-gray-600">
                <Plus className="w-4 h-4" /> Video
                <input type="file" accept="video/*" hidden onChange={(e) => addSlide(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Each slide is a full-screen image or video with its own heading and button. They auto-rotate on the homepage hero. Video max 60MB.
          </p>
          {s.heroSlides.length === 0 && <p className="text-sm text-gray-400">No slides yet — add an image or video.</p>}

          {s.heroSlides.map((sl, i) => (
            <div key={i} className="flex gap-3 items-start border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="w-28 h-20 rounded overflow-hidden bg-gray-200 dark:bg-gray-900 shrink-0">
                {sl.type === "video" ? (
                  <video src={sl.src} muted className="w-full h-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sl.src} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <input value={sl.heading} onChange={(e) => updateSlide(i, { heading: e.target.value })} placeholder="Large heading" className={input} />
                <input value={sl.subheading} onChange={(e) => updateSlide(i, { subheading: e.target.value })} placeholder="Small line above heading (optional)" className={input} />
                <div className="grid grid-cols-2 gap-2">
                  <input value={sl.ctaText} onChange={(e) => updateSlide(i, { ctaText: e.target.value })} placeholder="Button text" className={input} />
                  <input value={sl.ctaLink} onChange={(e) => updateSlide(i, { ctaLink: e.target.value })} placeholder="Button link (e.g. /shop)" className={input} />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Align:</span>
                  <select value={sl.align} onChange={(e) => updateSlide(i, { align: e.target.value as HeroSlide["align"] })} className="bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5">
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                  <span className="ml-2 text-xs uppercase tracking-wide text-gray-400">{sl.type}</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <button onClick={() => moveSlide(i, -1)} disabled={i === 0} className="text-gray-500 hover:text-primary disabled:opacity-30 px-2">▲</button>
                <button onClick={() => moveSlide(i, 1)} disabled={i === s.heroSlides.length - 1} className="text-gray-500 hover:text-primary disabled:opacity-30 px-2">▼</button>
                <button onClick={() => set("heroSlides", s.heroSlides.filter((_, k) => k !== i))} className="text-red-500 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
              </div>
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Delivery fee by province</label>
              <button
                type="button"
                onClick={() => set("deliveryProvinces", [...s.deliveryProvinces, { name: "", fee: s.deliveryFee }])}
                className="text-sm text-primary font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add province
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-2">Customers pick their province at checkout; its fee is applied (the flat fee above is the fallback).</p>
            <div className="space-y-2">
              {s.deliveryProvinces.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={p.name}
                    onChange={(e) => set("deliveryProvinces", s.deliveryProvinces.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))}
                    placeholder="Province"
                    className={`${input} flex-1`}
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm text-gray-500">Rs</span>
                    <input
                      type="number"
                      value={p.fee}
                      onChange={(e) => set("deliveryProvinces", s.deliveryProvinces.map((x, k) => (k === i ? { ...x, fee: Number(e.target.value) || 0 } : x)))}
                      className={`${input} w-28`}
                    />
                  </div>
                  <button type="button" onClick={() => set("deliveryProvinces", s.deliveryProvinces.filter((_, k) => k !== i))} className="text-red-500 hover:text-red-600 p-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
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
