"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Megaphone, Plus, Pencil, Trash2, Copy, X, Eye } from "lucide-react";
import {
  listPopups, savePopup, togglePopup, deletePopup,
  type AdminPopup, type PopupInput,
} from "./actions";

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", "store");
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Upload failed");
  return json.url as string;
}

const BLANK: PopupInput = {
  name: "", isActive: true, priority: 0, layout: "center", heading: "", body: "",
  imageUrl: "", ctaText: "", ctaLink: "", couponCode: "", accentColor: "#111827",
  trigger: "delay", triggerValue: 30, frequency: "session", showOn: "all",
  device: "all", audience: "all", startAt: "", endAt: "",
};

const SELECTS = {
  layout: ["center", "corner", "bar"],
  trigger: ["immediate", "delay", "scroll", "exit"],
  frequency: ["always", "session", "daily", "once"],
  showOn: ["all", "home", "shop", "product"],
  device: ["all", "desktop", "mobile"],
  audience: ["all", "new", "returning"],
} as const;

function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PromosPage() {
  const [rows, setRows] = useState<AdminPopup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PopupInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    try { setRows(await listPopups()); } catch { toast.error("Failed to load popups"); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function set<K extends keyof PopupInput>(k: K, v: PopupInput[K]) {
    setEditing((e) => (e ? { ...e, [k]: v } : e));
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    const res = await savePopup(editing);
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Saved");
    setEditing(null);
    load();
  }

  async function onToggle(p: AdminPopup) {
    const res = await togglePopup(p.id, !p.isActive);
    if (!res.ok) return toast.error(res.error);
    setRows((r) => r.map((x) => (x.id === p.id ? { ...x, isActive: !x.isActive } : x)));
  }

  async function onDelete(p: AdminPopup) {
    if (!confirm(`Delete "${p.name || p.heading}"?`)) return;
    const res = await deletePopup(p.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Deleted");
    load();
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { set("imageUrl", await uploadFile(file)); toast.success("Image uploaded"); }
    catch (err: any) { toast.error(err.message || "Upload failed"); }
    setUploading(false);
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <Toaster position="top-right" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-primary" /> Promo Popups
        </h1>
        {!editing && (
          <button onClick={() => setEditing({ ...BLANK })}
            className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Popup
          </button>
        )}
      </div>

      {editing ? (
        <Editor
          value={editing} set={set} save={save} saving={saving}
          cancel={() => setEditing(null)} onPickImage={onPickImage} uploading={uploading}
        />
      ) : loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="text-center text-gray-500 border border-dashed rounded-xl py-16">
          No popups yet. Click <b>New Popup</b> to create your first campaign.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => {
            const ctr = p.impressions ? Math.round((p.clicks / p.impressions) * 100) : 0;
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-4 bg-white dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="flex-1 min-w-[12rem]">
                  <div className="font-semibold">{p.name || p.heading || "Untitled"}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {p.layout} · {p.trigger}{p.trigger === "delay" ? ` ${p.triggerValue}s` : p.trigger === "scroll" ? ` ${p.triggerValue}%` : ""} · {p.frequency} · {p.showOn} · {p.device}
                  </div>
                </div>
                <div className="text-xs text-gray-500 text-center">
                  <div><b className="text-gray-800 dark:text-gray-200">{p.impressions}</b> views</div>
                  <div><b className="text-gray-800 dark:text-gray-200">{p.clicks}</b> clicks · {ctr}%</div>
                </div>
                <button onClick={() => onToggle(p)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {p.isActive ? "Active" : "Off"}
                </button>
                <button onClick={() => setEditing({ ...p, startAt: toLocalInput(p.startAt), endAt: toLocalInput(p.endAt) })}
                  className="p-2 text-gray-600 hover:text-primary"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => onDelete(p)} className="p-2 text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Editor({ value, set, save, saving, cancel, onPickImage, uploading }: {
  value: PopupInput;
  set: <K extends keyof PopupInput>(k: K, v: PopupInput[K]) => void;
  save: () => void; saving: boolean; cancel: () => void;
  onPickImage: (e: React.ChangeEvent<HTMLInputElement>) => void; uploading: boolean;
}) {
  const accent = value.accentColor || "#111827";
  const input = "w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm";
  const label = "block text-xs font-semibold text-gray-500 mb-1";

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* form */}
      <div className="space-y-5 bg-white dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <Section title="Content">
          <div><label className={label}>Name (internal)</label><input className={input} value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. October sale" /></div>
          <div><label className={label}>Heading</label><input className={input} value={value.heading} onChange={(e) => set("heading", e.target.value)} placeholder="20% OFF everything!" /></div>
          <div><label className={label}>Body</label><textarea className={input} rows={2} value={value.body} onChange={(e) => set("body", e.target.value)} placeholder="Use code at checkout. Ends Sunday." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>CTA text</label><input className={input} value={value.ctaText ?? ""} onChange={(e) => set("ctaText", e.target.value)} placeholder="Shop now" /></div>
            <div><label className={label}>CTA link</label><input className={input} value={value.ctaLink ?? ""} onChange={(e) => set("ctaLink", e.target.value)} placeholder="/shop" /></div>
          </div>
          <div><label className={label}>Coupon code (optional)</label><input className={input} value={value.couponCode ?? ""} onChange={(e) => set("couponCode", e.target.value)} placeholder="SAVE20" /></div>
          <div>
            <label className={label}>Image (optional)</label>
            <div className="flex items-center gap-2">
              <input className={input} value={value.imageUrl ?? ""} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…" />
              <label className="shrink-0 text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg cursor-pointer">
                {uploading ? "…" : "Upload"}
                <input type="file" accept="image/*" className="hidden" onChange={onPickImage} />
              </label>
            </div>
          </div>
        </Section>

        <Section title="Design">
          <div className="flex items-center gap-4">
            <div><label className={label}>Layout</label><Sel k="layout" value={value} set={set} /></div>
            <div><label className={label}>Accent colour</label>
              <input type="color" value={accent} onChange={(e) => set("accentColor", e.target.value)} className="h-9 w-16 rounded border border-gray-200" />
            </div>
          </div>
        </Section>

        <Section title="Trigger & targeting">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Trigger</label><Sel k="trigger" value={value} set={set} /></div>
            <div>
              <label className={label}>{value.trigger === "scroll" ? "Scroll %" : value.trigger === "delay" ? "Delay (seconds)" : "Value"}</label>
              <input type="number" min={0} className={input} value={value.triggerValue} onChange={(e) => set("triggerValue", Number(e.target.value || 0))} disabled={value.trigger === "immediate" || value.trigger === "exit"} />
            </div>
            <div><label className={label}>Show again</label><Sel k="frequency" value={value} set={set} /></div>
            <div><label className={label}>Priority</label><input type="number" className={input} value={value.priority} onChange={(e) => set("priority", Number(e.target.value || 0))} /></div>
            <div><label className={label}>Pages</label><Sel k="showOn" value={value} set={set} /></div>
            <div><label className={label}>Device</label><Sel k="device" value={value} set={set} /></div>
            <div><label className={label}>Visitors</label><Sel k="audience" value={value} set={set} /></div>
          </div>
        </Section>

        <Section title="Schedule (optional)">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Start</label><input type="datetime-local" className={input} value={value.startAt ?? ""} onChange={(e) => set("startAt", e.target.value)} /></div>
            <div><label className={label}>End</label><input type="datetime-local" className={input} value={value.endAt ?? ""} onChange={(e) => set("endAt", e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm mt-2">
            <input type="checkbox" checked={value.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Active
          </label>
        </Section>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={cancel} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700">Cancel</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 rounded-lg bg-primary text-white disabled:opacity-60">{saving ? "Saving…" : "Save popup"}</button>
        </div>
      </div>

      {/* live preview */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Live preview</p>
        <div className="relative rounded-xl bg-gray-100 dark:bg-gray-800 min-h-[420px] grid place-items-center p-6 overflow-hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
            <button className="absolute top-3 right-3 grid place-items-center w-8 h-8 rounded-full bg-white/80 text-gray-700 shadow"><X className="w-4 h-4" /></button>
            {value.imageUrl ? <img src={value.imageUrl} alt="" className="w-full h-40 object-cover" /> : null}
            <div className="p-6 text-center">
              <h2 className="text-2xl font-extrabold leading-tight" style={{ color: accent }}>{value.heading || "Your heading"}</h2>
              {value.body ? <p className="mt-2 text-[15px] text-gray-600">{value.body}</p> : <p className="mt-2 text-[15px] text-gray-400">Your message…</p>}
              {value.couponCode ? (
                <span className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-dashed px-4 py-2.5 font-mono font-bold tracking-wider" style={{ borderColor: accent, color: accent }}>
                  {value.couponCode} <Copy className="w-4 h-4" />
                </span>
              ) : null}
              {value.ctaText ? <div className="mt-5 rounded-xl py-3 font-semibold text-white" style={{ backgroundColor: accent }}>{value.ctaText}</div> : null}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">Preview shows the centre layout; corner/bar differ on the live site.</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">{title}</h3>
      {children}
    </div>
  );
}

function Sel<K extends keyof typeof SELECTS>({ k, value, set }: {
  k: K; value: PopupInput; set: <KK extends keyof PopupInput>(k: KK, v: PopupInput[KK]) => void;
}) {
  return (
    <select
      className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm capitalize"
      value={value[k] as string}
      onChange={(e) => set(k as keyof PopupInput, e.target.value as any)}
    >
      {SELECTS[k].map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
