"use client";

import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Printer,
  Shirt,
  Calculator,
  MessageCircle,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Copy,
  Check,
  Tag,
  Layers,
  Package,
  TrendingUp,
  Wallet,
  Settings,
} from "lucide-react";
import {
  getPriceItems,
  addPriceItem,
  updatePriceItem,
  deletePriceItem,
  getQuotes,
  saveQuote,
  deleteQuote,
  getTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  getDtfPageSettings,
  saveDtfPageSettings,
} from "./actions";

/* ---------------- Types ---------------- */
type PriceItem = {
  Id: string;
  Category: "Garment" | "Print" | "Overhead" | "Profit" | string;
  Name: string;
  Amount: number;
  Unit: string | null;
  SortOrder: number;
  IsActive: boolean;
  UpdatedAt: string;
};

type Quote = {
  Id: string;
  QuoteRef: string;
  CustomerName: string | null;
  CustomerPhone: string | null;
  GarmentName: string;
  PrintNames: string | null;
  Quantity: number;
  UnitPrice: number;
  Total: number;
  Profit: number;
  Extra: number;
  FinalTotal: number;
  AdvancePct: number;
  AdvanceAmount: number;
  CreatedAt: string;
};

type Template = {
  Id: string;
  Title: string;
  Content: string;
  Category: string;
  Language: string;
  SortOrder: number;
  IsActive: boolean;
  UpdatedAt: string;
};

// Garments are real products now (managed in Stocks → Storefront Catalog), so the
// Price Setup tab only manages print rates / overheads / profit / charges. The
// Quote Builder still reads any existing "Garment" price rows for manual quotes.
const CATEGORIES = ["Print", "Overhead", "Profit", "Charge"] as const;
const CAT_META: Record<string, { label: string; icon: any; color: string }> = {
  Garment: { label: "Garments (Blank Cost)", icon: Shirt, color: "text-blue-500" },
  Print: { label: "Print Rates", icon: Printer, color: "text-purple-500" },
  Overhead: { label: "Packaging & Utilities", icon: Package, color: "text-amber-500" },
  Profit: { label: "Profit", icon: TrendingUp, color: "text-green-500" },
  Charge: { label: "Order Extra & Advance", icon: Wallet, color: "text-rose-500" },
};

const TABS = [
  { key: "prices", label: "Price Setup", icon: Tag },
  { key: "builder", label: "Quote Builder", icon: Calculator },
  { key: "templates", label: "Sinhala Templates", icon: MessageCircle },
  { key: "page", label: "Customize Page", icon: Settings },
] as const;

export default function DtfPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("prices");
  const [items, setItems] = useState<PriceItem[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    try {
      const [pi, q, t] = await Promise.all([
        getPriceItems(),
        getQuotes(),
        getTemplates(),
      ]);
      setItems(pi as PriceItem[]);
      setQuotes(q as Quote[]);
      setTemplates(t as Template[]);
    } catch {
      toast.error("Failed to load DTF data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-primary/20 p-3 rounded-lg">
          <Printer className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">DTF Printing</h1>
          <p className="text-sm text-gray-500">
            Pricing, instant customer quotes & Sinhala message templates
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {tab === "prices" && (
            <PriceSetup items={items} reload={loadAll} />
          )}
          {tab === "builder" && (
            <QuoteBuilder items={items} quotes={quotes} reload={loadAll} />
          )}
          {tab === "templates" && (
            <Templates
              templates={templates}
              items={items}
              reload={loadAll}
            />
          )}
          {tab === "page" && <CustomizePageTab />}
        </>
      )}
    </div>
  );
}

/* ============================================================
   TAB 4 — CUSTOMIZE PAGE CONTENT (intro note + suggestions)
   ============================================================ */
function CustomizePageTab() {
  const [introNote, setIntroNote] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await getDtfPageSettings();
        setIntroNote(s.introNote);
        setSuggestions(s.suggestions.length ? s.suggestions : [""]);
        setWhatsapp(s.whatsapp);
      } catch {
        toast.error("Failed to load page settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      await saveDtfPageSettings(introNote, suggestions);
      toast.success("Customize page updated");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-1">Customize Page Content</h2>
        <p className="text-sm text-gray-500 mb-4">
          Shown to customers on the storefront <code className="px-1 bg-gray-100 dark:bg-gray-700 rounded">/customize</code> page.
          The contact number comes from Store Settings (WhatsApp): <b>{whatsapp || "not set"}</b>.
        </p>

        <label className="block text-sm font-medium mb-2">Intro note / disclaimer</label>
        <textarea
          value={introNote}
          onChange={(e) => setIntroNote(e.target.value)}
          rows={3}
          className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm"
        />

        <label className="block text-sm font-medium mt-5 mb-2">Suggestions for customers</label>
        <div className="space-y-2">
          {suggestions.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={s}
                onChange={(e) =>
                  setSuggestions((prev) => prev.map((x, k) => (k === i ? e.target.value : x)))
                }
                placeholder="e.g. Send high-resolution artwork (300 DPI)"
                className="flex-1 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm"
              />
              <button
                onClick={() => setSuggestions((prev) => prev.filter((_, k) => k !== i))}
                className="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setSuggestions((prev) => [...prev, ""])}
          className="mt-3 text-sm font-medium text-primary flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add suggestion
        </button>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-semibold disabled:opacity-50"
      >
        <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

/* ============================================================
   PRICING HELPERS (shared)
   ============================================================ */
function useDerived(items: PriceItem[]) {
  return useMemo(() => {
    const active = items.filter((i) => i.IsActive);
    const garments = active.filter((i) => i.Category === "Garment");
    const prints = active.filter((i) => i.Category === "Print");
    const overheads = active.filter((i) => i.Category === "Overhead");
    const overheadTotal = overheads.reduce((s, i) => s + Number(i.Amount), 0);
    const packaging =
      overheads.find((i) => /pack/i.test(i.Name))?.Amount ?? 0;
    const utilities =
      overheads.find((i) => /util/i.test(i.Name))?.Amount ?? 0;
    const defaultProfit =
      active.find((i) => i.Category === "Profit")?.Amount ?? 0;
    const charges = active.filter((i) => i.Category === "Charge");
    const defaultExtra =
      charges.find((i) => /extra|handling|deliver/i.test(i.Name))?.Amount ?? 0;
    const defaultAdvancePct =
      charges.find((i) => /advance|deposit/i.test(i.Name))?.Amount ?? 0;
    return {
      garments,
      prints,
      overheads,
      overheadTotal,
      packaging: Number(packaging),
      utilities: Number(utilities),
      defaultProfit: Number(defaultProfit),
      defaultExtra: Number(defaultExtra),
      defaultAdvancePct: Number(defaultAdvancePct),
    };
  }, [items]);
}

function buildPriceListText(items: PriceItem[]): string {
  const d = {
    garments: items.filter((i) => i.IsActive && i.Category === "Garment"),
    print: items.find(
      (i) => i.IsActive && i.Category === "Print" && /front/i.test(i.Name)
    ),
    overheadTotal: items
      .filter((i) => i.IsActive && i.Category === "Overhead")
      .reduce((s, i) => s + Number(i.Amount), 0),
    profit: items.find((i) => i.IsActive && i.Category === "Profit")?.Amount ?? 0,
  };
  const printCost = Number(d.print?.Amount ?? 0);
  const lines = d.garments.map((g) => {
    const price =
      Number(g.Amount) + printCost + d.overheadTotal + Number(d.profit);
    return `• ${g.Name} (Front Print) — Rs ${Math.round(price)}`;
  });
  return lines.join("\n");
}

/* ============================================================
   TAB 1 — PRICE SETUP
   ============================================================ */
function PriceSetup({
  items,
  reload,
}: {
  items: PriceItem[];
  reload: () => void;
}) {
  const empty = { id: "", category: "Print", name: "", amount: "", unit: "per print" };
  const [form, setForm] = useState<typeof empty>(empty);
  const [editing, setEditing] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || form.amount === "") {
      toast.error("Name and amount are required");
      return;
    }
    try {
      if (editing) {
        await updatePriceItem(form.id, {
          category: form.category,
          name: form.name,
          amount: form.amount,
          unit: form.unit,
          isActive: true,
        });
        toast.success("Price updated");
      } else {
        await addPriceItem({
          category: form.category,
          name: form.name,
          amount: form.amount,
          unit: form.unit,
        });
        toast.success("Price added");
      }
      setForm(empty);
      setEditing(false);
      reload();
    } catch {
      toast.error("Failed to save");
    }
  }

  function edit(i: PriceItem) {
    setForm({
      id: i.Id,
      category: i.Category,
      name: i.Name,
      amount: String(i.Amount),
      unit: i.Unit || "",
    });
    setEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id: string) {
    if (!confirm("Delete this price item?")) return;
    try {
      await deletePriceItem(id);
      toast.success("Deleted");
      reload();
    } catch {
      toast.error("Failed to delete");
    }
  }

  return (
    <div>
      {/* Note */}
      <div className="mb-4 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
        Garments (T-Shirts, Shorts, Skinners…) are managed as real products in{" "}
        <b>Stocks → Storefront Catalog</b> (mark them <b>DTF printable</b>). Here you only set the
        print rates, overheads, profit and charges added on top.
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          {editing ? <Edit2 className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
          {editing ? "Edit Price Item" : "Add Price Item"}
        </h2>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CAT_META[c].label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Oversize T-Shirt / A3 Print"
              className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Amount (Rs)</label>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
              className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Unit</label>
            <input
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="per piece"
              className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5"
            />
          </div>
          <div className="md:col-span-5 flex gap-3">
            <button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-semibold"
            >
              <Save className="w-4 h-4" />
              {editing ? "Update" : "Add"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setForm(empty);
                  setEditing(false);
                }}
                className="bg-gray-200 dark:bg-gray-700 px-6 py-2.5 rounded-lg flex items-center gap-2"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Grouped lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {CATEGORIES.map((cat) => {
          const meta = CAT_META[cat];
          const Icon = meta.icon;
          const rows = items.filter((i) => i.Category === cat);
          return (
            <div
              key={cat}
              className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
            >
              <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                <Icon className={`w-5 h-5 ${meta.color}`} />
                <h3 className="font-semibold">{meta.label}</h3>
              </div>
              {rows.length === 0 ? (
                <p className="p-5 text-sm text-gray-500">No items yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {rows.map((i) => (
                      <tr
                        key={i.Id}
                        className="border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                      >
                        <td className="px-5 py-3 font-medium">
                          {i.Name}
                          {!i.IsActive && (
                            <span className="ml-2 text-xs text-gray-400">(hidden)</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-gray-500">{i.Unit}</td>
                        <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                          Rs {Number(i.Amount).toFixed(2)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => edit(i)}
                              className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => remove(i.Id)}
                              className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   TAB 2 — QUOTE BUILDER
   ============================================================ */
function QuoteBuilder({
  items,
  quotes,
  reload,
}: {
  items: PriceItem[];
  quotes: Quote[];
  reload: () => void;
}) {
  const d = useDerived(items);
  const [garmentId, setGarmentId] = useState("");
  const [printIds, setPrintIds] = useState<string[]>([]);
  const [qty, setQty] = useState("1");
  const [profitOverride, setProfitOverride] = useState("");
  const [extraInput, setExtraInput] = useState("");
  const [advanceInput, setAdvanceInput] = useState("");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState(false);
  const [msgMode, setMsgMode] = useState<"quote" | "advance">("quote");

  useEffect(() => {
    if (!garmentId && d.garments.length) setGarmentId(d.garments[0].Id);
  }, [d.garments, garmentId]);

  const garment = d.garments.find((g) => g.Id === garmentId);
  const selectedPrints = d.prints.filter((p) => printIds.includes(p.Id));
  const quantity = Math.max(1, Number(qty) || 1);
  const garmentCost = Number(garment?.Amount ?? 0);
  const printCost = selectedPrints.reduce((s, p) => s + Number(p.Amount), 0);
  const profit =
    profitOverride !== "" ? Number(profitOverride) || 0 : d.defaultProfit;
  const unitPrice =
    garmentCost + printCost + d.packaging + d.utilities + profit;
  const total = unitPrice * quantity;
  // Per-order flat extra (e.g. +90) and advance deposit — both editable.
  const extra = extraInput !== "" ? Number(extraInput) || 0 : d.defaultExtra;
  const advancePct =
    advanceInput !== "" ? Number(advanceInput) || 0 : d.defaultAdvancePct;
  const finalTotal = total + extra;
  const advanceAmount = Math.round((finalTotal * advancePct) / 100);

  function togglePrint(id: string) {
    setPrintIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  const customerMessage = useMemo(() => {
    if (!garment) return "";
    const printText = selectedPrints.length
      ? selectedPrints.map((p) => p.Name).join(" + ")
      : "No print";
    return [
      customer ? `Hello ${customer} 🙏` : `Ayubowan 🙏`,
      ``,
      `👕 Item: ${garment.Name}`,
      `🖨️ Print: ${printText}`,
      `🔢 Qty: ${quantity}`,
      ``,
      `🧾 මුළු මිල: *Rs ${Math.round(finalTotal)}*`,
      advancePct > 0
        ? `💳 Advance (${advancePct}%): *Rs ${advanceAmount}*`
        : ``,
      ``,
      `Order එක confirm කරන්නද? ✅ — EssenceFit DTF`,
    ]
      .filter((l) => l !== null)
      .join("\n");
  }, [
    garment,
    selectedPrints,
    quantity,
    finalTotal,
    advancePct,
    advanceAmount,
    customer,
  ]);

  // Polite Sinhala advance-payment message with live values filled in.
  const advanceMessage = useMemo(() => {
    if (!garment) return "";
    const printText = selectedPrints.length
      ? selectedPrints.map((p) => p.Name).join(" + ")
      : "No print";
    const balance = finalTotal - advanceAmount;
    return [
      customer ? `Hello ${customer} 🙏✨` : `ස්තූතියි ඔයාගේ order එකට 🙏✨`,
      ``,
      `👕 Item: ${garment.Name}`,
      `🖨️ Print: ${printText}`,
      `🔢 Qty: ${quantity}`,
      ``,
      `අපි custom DTF print කරන නිසා, order එක confirm කරන්න මුළු මුදලෙන් *${advancePct}%ක advance* එකක් අවශ්‍යයි 🙂`,
      ``,
      `🧾 මුළු මිල: Rs ${Math.round(finalTotal)}`,
      `💳 Advance (${advancePct}%): *Rs ${advanceAmount}*`,
      `🚚 ඉතිරි මුදල (Rs ${Math.round(balance)}) parcel එක ලැබෙද්දී ගෙවන්න පුළුවන්`,
      ``,
      `🏦 Bank: HNB (Koggala)`,
      `👤 M.G.Arosha Ravishan`,
      `🔢 237020072483`,
      ``,
      `📸 Advance එක දාලා slip එක එවන්න, මම order එක වහාම start කරන්නම් ✅`,
    ].join("\n");
  }, [
    garment,
    selectedPrints,
    quantity,
    finalTotal,
    advancePct,
    advanceAmount,
    customer,
  ]);

  const activeMessage = msgMode === "advance" ? advanceMessage : customerMessage;

  async function copyMessage() {
    await navigator.clipboard.writeText(activeMessage);
    setCopied(true);
    toast.success(msgMode === "advance" ? "Advance message copied 💬" : "Quote copied 💬");
    setTimeout(() => setCopied(false), 1500);
  }

  async function persist() {
    if (!garment) {
      toast.error("Select a garment");
      return;
    }
    try {
      const ref = await saveQuote({
        customerName: customer || undefined,
        customerPhone: phone || undefined,
        garmentName: garment.Name,
        printNames: selectedPrints.map((p) => p.Name).join(", ") || undefined,
        quantity,
        garmentCost,
        printCost,
        packaging: d.packaging,
        utilities: d.utilities,
        profit,
        unitPrice,
        total,
        extra,
        finalTotal,
        advancePct,
        advanceAmount,
        breakdownJson: JSON.stringify({
          garment: garment.Name,
          garmentCost,
          prints: selectedPrints.map((p) => ({ name: p.Name, amount: Number(p.Amount) })),
          packaging: d.packaging,
          utilities: d.utilities,
          profit,
          unitPrice,
          quantity,
          total,
          extra,
          finalTotal,
          advancePct,
          advanceAmount,
        }),
      });
      toast.success(`Saved as ${ref}`);
      reload();
    } catch {
      toast.error("Failed to save quote");
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: inputs */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" /> Build a Quote
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Garment</label>
            <select
              value={garmentId}
              onChange={(e) => setGarmentId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5"
            >
              {d.garments.map((g) => (
                <option key={g.Id} value={g.Id}>
                  {g.Name} — Rs {Number(g.Amount).toFixed(0)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Layers className="w-4 h-4" /> Prints (select one or more)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {d.prints.map((p) => {
                const on = printIds.includes(p.Id);
                return (
                  <button
                    key={p.Id}
                    type="button"
                    onClick={() => togglePrint(p.Id)}
                    className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    }`}
                  >
                    <span className="font-medium">{p.Name}</span>
                    <span className="block text-xs opacity-70">
                      Rs {Number(p.Amount).toFixed(0)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Quantity</label>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Profit / pc (Rs)
              </label>
              <input
                type="number"
                value={profitOverride}
                onChange={(e) => setProfitOverride(e.target.value)}
                placeholder={`Default ${d.defaultProfit}`}
                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Order Extra (Rs)
              </label>
              <input
                type="number"
                value={extraInput}
                onChange={(e) => setExtraInput(e.target.value)}
                placeholder={`Default ${d.defaultExtra}`}
                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Advance (%)
              </label>
              <input
                type="number"
                value={advanceInput}
                onChange={(e) => setAdvanceInput(e.target.value)}
                placeholder={`Default ${d.defaultAdvancePct}`}
                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Customer (optional)
              </label>
              <input
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Name"
                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Phone (optional)
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07X XXX XXXX"
                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right: breakdown + message */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h3 className="font-semibold mb-4">Cost Breakdown (per piece)</h3>
          <BreakdownRow label={`Garment — ${garment?.Name || "-"}`} value={garmentCost} />
          {selectedPrints.map((p) => (
            <BreakdownRow key={p.Id} label={`Print — ${p.Name}`} value={Number(p.Amount)} />
          ))}
          <BreakdownRow label="Packaging" value={d.packaging} />
          <BreakdownRow label="Utilities" value={d.utilities} />
          <BreakdownRow label="Profit" value={profit} highlight />
          <div className="border-t border-gray-200 dark:border-gray-700 mt-3 pt-3 flex justify-between font-semibold">
            <span>Unit Price</span>
            <span>Rs {unitPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between mt-1 text-sm">
            <span>Subtotal × {quantity}</span>
            <span>Rs {total.toFixed(2)}</span>
          </div>
          <BreakdownRow label="Order Extra" value={extra} />
          <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2 flex justify-between text-lg font-bold text-primary">
            <span>Final Total</span>
            <span>Rs {finalTotal.toFixed(2)}</span>
          </div>
          {advancePct > 0 && (
            <div className="flex justify-between mt-2 text-sm bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg px-3 py-2 font-medium">
              <span>Advance to collect ({advancePct}%)</span>
              <span>Rs {advanceAmount.toFixed(2)}</span>
            </div>
          )}
          {advancePct > 0 && (
            <div className="flex justify-between mt-1 text-xs text-gray-500 px-3">
              <span>Balance on delivery</span>
              <span>Rs {(finalTotal - advanceAmount).toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Customer Message</h3>
            <div className="flex gap-2">
              <button
                onClick={copyMessage}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={persist}
                className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm"
              >
                <Save className="w-4 h-4" /> Save
              </button>
            </div>
          </div>

          {/* Message type toggle */}
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-700 p-0.5 mb-3">
            <button
              onClick={() => setMsgMode("quote")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                msgMode === "quote"
                  ? "bg-primary text-white"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              Quote
            </button>
            <button
              onClick={() => setMsgMode("advance")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                msgMode === "advance"
                  ? "bg-rose-600 text-white"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              Advance ({advancePct || 0}%)
            </button>
          </div>

          <pre className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-sm whitespace-pre-wrap font-sans">
            {activeMessage}
          </pre>
        </div>
      </div>

      {/* Recent quotes */}
      <div className="lg:col-span-2 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold">
          Recent Quotes
        </div>
        {quotes.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">No saved quotes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700/50">
                <tr>
                  <th className="p-3 text-left">Ref</th>
                  <th className="p-3 text-left">Customer</th>
                  <th className="p-3 text-left">Item</th>
                  <th className="p-3 text-left">Print</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-right">Unit</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">Advance</th>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr
                    key={q.Id}
                    className="border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  >
                    <td className="p-3 font-medium">{q.QuoteRef}</td>
                    <td className="p-3">{q.CustomerName || "-"}</td>
                    <td className="p-3">{q.GarmentName}</td>
                    <td className="p-3 text-gray-500">{q.PrintNames || "-"}</td>
                    <td className="p-3 text-right">{q.Quantity}</td>
                    <td className="p-3 text-right">Rs {Number(q.UnitPrice).toFixed(0)}</td>
                    <td className="p-3 text-right font-semibold">
                      Rs {Number(q.FinalTotal || q.Total).toFixed(0)}
                    </td>
                    <td className="p-3 text-right text-rose-600 dark:text-rose-400">
                      {Number(q.AdvanceAmount) > 0
                        ? `Rs ${Number(q.AdvanceAmount).toFixed(0)}`
                        : "-"}
                    </td>
                    <td className="p-3 text-gray-500">
                      {new Date(q.CreatedAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={async () => {
                          if (!confirm("Delete quote?")) return;
                          await deleteQuote(q.Id);
                          toast.success("Deleted");
                          reload();
                        }}
                        className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className={highlight ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-300"}>
        {label}
      </span>
      <span className={highlight ? "text-green-600 dark:text-green-400 font-medium" : ""}>
        Rs {value.toFixed(2)}
      </span>
    </div>
  );
}

/* ============================================================
   TAB 3 — SINHALA TEMPLATES
   ============================================================ */
function Templates({
  templates,
  items,
  reload,
}: {
  templates: Template[];
  items: PriceItem[];
  reload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "General",
    language: "Sinhala",
  });

  const priceList = useMemo(() => buildPriceListText(items), [items]);

  // Replace live placeholders. {price_list} -> current list.
  function render(content: string) {
    return content.replace(/\{price_list\}/g, priceList);
  }

  function openModal(t?: Template) {
    if (t) {
      setEditing(t);
      setForm({
        title: t.Title,
        content: t.Content,
        category: t.Category,
        language: t.Language,
      });
    } else {
      setEditing(null);
      setForm({ title: "", content: "", category: "General", language: "Sinhala" });
    }
    setOpen(true);
  }

  async function save() {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    try {
      if (editing) {
        await updateTemplate(editing.Id, form);
        toast.success("Template updated");
      } else {
        await addTemplate(form);
        toast.success("Template added");
      }
      setOpen(false);
      reload();
    } catch {
      toast.error("Failed to save");
    }
  }

  async function copy(t: Template) {
    await navigator.clipboard.writeText(render(t.Content));
    setCopiedId(t.Id);
    toast.success("Copied 💬");
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function remove(id: string) {
    if (!confirm("Delete template?")) return;
    await deleteTemplate(id);
    toast.success("Deleted");
    reload();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          Tip: use <code className="px-1 bg-gray-100 dark:bg-gray-700 rounded">{"{price_list}"}</code> in any
          template — it auto-fills with your current prices when copied.
        </p>
        <button
          onClick={() => openModal()}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl">
          <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No templates yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div
              key={t.Id}
              className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold">{t.Title}</h3>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {t.Language}
                </span>
              </div>
              <span className="text-xs text-gray-500 mb-2">{t.Category}</span>
              <pre className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-sm whitespace-pre-wrap font-sans flex-1 max-h-48 overflow-y-auto mb-3">
                {render(t.Content)}
              </pre>
              <div className="flex gap-2">
                <button
                  onClick={() => copy(t)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 text-sm"
                >
                  {copiedId === t.Id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedId === t.Id ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => openModal(t)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => remove(t.Id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                {editing ? "Edit Template" : "New Template"}
              </h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Greeting / Quote / Payment"
                    className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Language</label>
                  <select
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5"
                  >
                    <option>Sinhala</option>
                    <option>English</option>
                    <option>Mixed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Content</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={12}
                  placeholder="Sinhala message... use {price_list} for live prices"
                  className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 font-sans text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Placeholders: {"{price_list}"} (auto-fills current prices)
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editing ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
