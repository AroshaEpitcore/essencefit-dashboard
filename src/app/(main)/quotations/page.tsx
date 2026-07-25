"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Save,
  Calendar,
  Loader2,
} from "lucide-react";
import {
  getQuotations,
  saveQuotation,
  deleteQuotation,
  getQuotationBusinessInfo,
} from "./actions";

/* ---------------------------------------------------------------- types */

type LineItem = {
  description: string;
  qty: number;
  unitPrice: number;
};

type BusinessInfo = {
  storeName: string;
  logo: string;
  contactPhone: string;
  contactEmail: string;
  bank: { bank: string; accountName: string; accountNo: string; branch: string };
};

type Quotation = {
  Id: string;
  QuoteRef: string;
  CustomerName: string | null;
  CustomerPhone: string | null;
  CustomerEmail: string | null;
  CustomerAddress: string | null;
  ItemsJson: string | null;
  Subtotal: number;
  Discount: number;
  OtherCharge: number;
  GrandTotal: number;
  Notes: string | null;
  ValidUntil: string | null;
  Status: string;
  CreatedAt: string;
};

const money = (n: number) =>
  Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyItem: LineItem = { description: "", qty: 1, unitPrice: 0 };

/* ---------------------------------------------------------------- PDF */

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  );
}

function generateQuotationHTML(
  q: {
    quoteRef: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    customerAddress: string;
    items: Array<LineItem & { amount: number }>;
    subtotal: number;
    discount: number;
    otherCharge: number;
    grandTotal: number;
    notes: string;
    validUntil: string;
    date: string;
  },
  b: BusinessInfo
): string {
  const itemsRows = q.items
    .map(
      (it, i) => `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td><div class="item-name">${esc(it.description)}</div></td>
        <td style="text-align:center;">${it.qty}</td>
        <td style="text-align:right;">Rs ${money(it.unitPrice)}</td>
        <td style="text-align:right;"><strong>Rs ${money(it.amount)}</strong></td>
      </tr>`
    )
    .join("");

  const brand = b.logo
    ? `<img src="${esc(b.logo)}" alt="${esc(b.storeName)}" class="brand-logo" />`
    : `<h2 class="brand-name">${esc(b.storeName || "EssenceFit")}</h2>`;

  const contactLine = [b.contactPhone, b.contactEmail].filter(Boolean).map(esc).join(" &nbsp;•&nbsp; ");

  const bank = b.bank || { bank: "", accountName: "", accountNo: "", branch: "" };
  const hasBank = bank.bank || bank.accountNo;

  return `
  <div id="quotation-root">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      #quotation-root { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #222; }
      .q-container { max-width: 800px; margin: 0 auto; background: #fff; }
      .q-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 3px solid #667eea; }
      .brand-logo { max-height: 70px; max-width: 240px; object-fit: contain; }
      .brand-name { font-size: 26px; color: #667eea; }
      .brand-contact { font-size: 12px; color: #666; margin-top: 8px; }
      .q-title { text-align: right; }
      .q-title h1 { font-size: 30px; letter-spacing: 2px; color: #667eea; }
      .q-title .ref { font-size: 13px; color: #555; margin-top: 4px; letter-spacing: 1px; }
      .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 28px 0; }
      .info-box h3 { font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 8px; letter-spacing: 1px; }
      .info-box p { font-size: 14px; line-height: 1.6; }
      .info-box p strong { display: block; font-size: 15px; margin-bottom: 2px; color: #222; }
      .meta { text-align: right; }
      table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
      table.items thead { background: #f4f5fb; }
      table.items th { padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #333; letter-spacing: 0.5px; border-bottom: 2px solid #667eea; }
      table.items td { padding: 12px; font-size: 13px; border-bottom: 1px solid #eee; }
      .item-name { font-weight: 600; }
      .totals { display: flex; justify-content: flex-end; margin-top: 24px; }
      .totals-box { width: 320px; }
      .trow { display: flex; justify-content: space-between; padding: 7px 0; font-size: 14px; }
      .trow.grand { border-top: 2px solid #667eea; margin-top: 6px; padding-top: 12px; font-size: 19px; font-weight: 700; color: #667eea; }
      .footer { margin-top: 36px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #555; line-height: 1.7; }
      .footer .notes { margin-bottom: 12px; }
      .footer .bank { background: #f8f9fb; border: 1px solid #eee; border-radius: 8px; padding: 12px; }
      .footer h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
      .thanks { text-align: center; margin-top: 20px; font-weight: 600; color: #667eea; }
    </style>

    <div class="q-container">
      <div class="q-header">
        <div>
          ${brand}
          ${contactLine ? `<div class="brand-contact">${contactLine}</div>` : ""}
        </div>
        <div class="q-title">
          <h1>QUOTATION</h1>
          <div class="ref">${esc(q.quoteRef)}</div>
        </div>
      </div>

      <div class="info-section">
        <div class="info-box">
          <h3>Quotation For</h3>
          <p>
            <strong>${esc(q.customerName) || "—"}</strong>
            ${q.customerPhone ? `${esc(q.customerPhone)}<br>` : ""}
            ${q.customerEmail ? `${esc(q.customerEmail)}<br>` : ""}
            ${q.customerAddress ? `${esc(q.customerAddress)}` : ""}
          </p>
        </div>
        <div class="info-box meta">
          <h3>Details</h3>
          <p>
            <strong>Date</strong>${esc(q.date)}<br>
            ${q.validUntil ? `<strong style="margin-top:8px;">Valid Until</strong>${esc(q.validUntil)}` : ""}
          </p>
        </div>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th style="text-align:center; width:36px;">#</th>
            <th>Description</th>
            <th style="text-align:center; width:60px;">Qty</th>
            <th style="text-align:right; width:110px;">Unit Price</th>
            <th style="text-align:right; width:120px;">Amount</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>

      <div class="totals">
        <div class="totals-box">
          <div class="trow"><span>Subtotal</span><span>Rs ${money(q.subtotal)}</span></div>
          ${q.discount > 0 ? `<div class="trow"><span>Discount</span><span>- Rs ${money(q.discount)}</span></div>` : ""}
          ${q.otherCharge > 0 ? `<div class="trow"><span>Other Charges</span><span>Rs ${money(q.otherCharge)}</span></div>` : ""}
          <div class="trow grand"><span>Total</span><span>Rs ${money(q.grandTotal)}</span></div>
        </div>
      </div>

      <div class="footer">
        ${q.notes ? `<div class="notes"><h4>Notes</h4>${esc(q.notes).replace(/\n/g, "<br>")}</div>` : ""}
        ${
          hasBank
            ? `<div class="bank">
                 <h4>Bank Details</h4>
                 ${bank.bank ? `${esc(bank.bank)}<br>` : ""}
                 ${bank.accountName ? `${esc(bank.accountName)}<br>` : ""}
                 ${bank.accountNo ? `A/C: ${esc(bank.accountNo)}` : ""}${bank.branch ? ` &nbsp;•&nbsp; ${esc(bank.branch)}` : ""}
               </div>`
            : ""
        }
        <div class="thanks">Thank you for your business!</div>
      </div>
    </div>
  </div>`;
}

function sanitize(name: string) {
  return String(name || "customer")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 50);
}

async function downloadQuotationPDF(
  q: Parameters<typeof generateQuotationHTML>[0],
  b: BusinessInfo
): Promise<void> {
  const html = generateQuotationHTML(q, b);

  const container = document.createElement("div");
  container.innerHTML = html;
  container.style.position = "fixed";
  container.style.left = "0";
  container.style.top = "0";
  container.style.width = "210mm";
  container.style.background = "white";
  container.style.pointerEvents = "none";
  container.style.zIndex = "999999";
  container.style.visibility = "hidden";
  document.body.appendChild(container);

  const element = container.querySelector("#quotation-root") as HTMLElement | null;
  if (!element) {
    container.remove();
    throw new Error("Quotation element not found");
  }

  try {
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r()))
    );
    // @ts-ignore
    if (document.fonts?.ready) await document.fonts.ready;

    container.style.visibility = "visible";
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const mod: any = await import("html2pdf.js");
    const html2pdf = mod?.default ?? mod;

    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `quotation_${sanitize(q.customerName)}_${q.quoteRef}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    } as const;

    await html2pdf().set(opt).from(element).save();
  } finally {
    container.remove();
  }
}

const fieldCls =
  "w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none";

/* ---------------------------------------------------------------- page */

export default function QuotationsPage() {
  // form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ ...emptyItem }]);
  const [discount, setDiscount] = useState(0);
  const [otherCharge, setOtherCharge] = useState(0);

  // list state
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Cache the business/store info so we fetch it at most once per session.
  const businessRef = useRef<BusinessInfo | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const q = await getQuotations();
      setQuotes(q as Quotation[]);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load quotations");
    } finally {
      setLoading(false);
    }
  }

  async function loadBusinessInfo() {
    if (!businessRef.current) businessRef.current = (await getQuotationBusinessInfo()) as BusinessInfo;
    return businessRef.current;
  }

  const computed = useMemo(() => {
    const withAmount = items.map((it) => ({
      ...it,
      amount: (Number(it.qty) || 0) * (Number(it.unitPrice) || 0),
    }));
    const subtotal = withAmount.reduce((s, it) => s + it.amount, 0);
    const grandTotal = Math.max(0, subtotal - (Number(discount) || 0) + (Number(otherCharge) || 0));
    return { withAmount, subtotal, grandTotal };
  }, [items, discount, otherCharge]);

  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { ...emptyItem }]);
  }
  function removeItem(i: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  function resetForm() {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setCustomerAddress("");
    setValidUntil("");
    setNotes("");
    setItems([{ ...emptyItem }]);
    setDiscount(0);
    setOtherCharge(0);
  }

  function validItems() {
    return computed.withAmount.filter((it) => it.description.trim());
  }

  async function handleSave() {
    const valid = validItems();
    if (valid.length === 0) {
      toast.error("Add at least one line item with a description");
      return;
    }
    setSaving(true);
    try {
      const ref = await saveQuotation({
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        itemsJson: JSON.stringify(valid.map(({ description, qty, unitPrice }) => ({ description, qty, unitPrice }))),
        subtotal: computed.subtotal,
        discount: Number(discount) || 0,
        otherCharge: Number(otherCharge) || 0,
        grandTotal: computed.grandTotal,
        notes: notes.trim() || undefined,
        validUntil: validUntil || null,
      });
      toast.success(`Quotation ${ref} saved 📄`);
      resetForm();
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save quotation");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadCurrent() {
    const valid = validItems();
    if (valid.length === 0) {
      toast.error("Add at least one line item to preview the PDF");
      return;
    }
    const toastId = toast.loading("Generating PDF...");
    try {
      const b = await loadBusinessInfo();
      await downloadQuotationPDF(
        {
          quoteRef: "DRAFT",
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim(),
          customerAddress: customerAddress.trim(),
          items: valid,
          subtotal: computed.subtotal,
          discount: Number(discount) || 0,
          otherCharge: Number(otherCharge) || 0,
          grandTotal: computed.grandTotal,
          notes: notes.trim(),
          validUntil,
          date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        },
        b
      );
      toast.success("PDF downloaded!", { id: toastId });
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate PDF", { id: toastId });
    }
  }

  async function handleDownloadSaved(q: Quotation) {
    setDownloadingId(q.Id);
    const toastId = toast.loading("Generating PDF...");
    try {
      const b = await loadBusinessInfo();
      let parsed: LineItem[] = [];
      try {
        parsed = JSON.parse(q.ItemsJson || "[]");
      } catch {
        parsed = [];
      }
      const withAmount = parsed.map((it) => ({
        ...it,
        amount: (Number(it.qty) || 0) * (Number(it.unitPrice) || 0),
      }));
      await downloadQuotationPDF(
        {
          quoteRef: q.QuoteRef,
          customerName: q.CustomerName || "",
          customerPhone: q.CustomerPhone || "",
          customerEmail: q.CustomerEmail || "",
          customerAddress: q.CustomerAddress || "",
          items: withAmount,
          subtotal: Number(q.Subtotal),
          discount: Number(q.Discount),
          otherCharge: Number(q.OtherCharge),
          grandTotal: Number(q.GrandTotal),
          notes: q.Notes || "",
          validUntil: q.ValidUntil ? new Date(q.ValidUntil).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "",
          date: new Date(q.CreatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        },
        b
      );
      toast.success("PDF downloaded!", { id: toastId });
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate PDF", { id: toastId });
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this quotation?")) return;
    try {
      await deleteQuotation(id);
      setQuotes((prev) => prev.filter((q) => q.Id !== id));
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    }
  }

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-primary/20 p-3 rounded-lg">
          <FileText className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Quotations</h1>
          <p className="text-sm text-gray-500">Build a customer quotation and download it as a branded PDF</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ---- Builder ---- */}
        <div className="xl:col-span-2 space-y-6">
          {/* Customer */}
          <section className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Customer</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className={fieldCls} placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              <input className={fieldCls} placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              <input className={fieldCls} placeholder="Email (optional)" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input type="date" className={`${fieldCls} pl-9`} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} title="Valid until" />
              </div>
              <textarea className={`${fieldCls} md:col-span-2`} placeholder="Address (optional)" rows={2} value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
            </div>
          </section>

          {/* Line items */}
          <section className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Line Items</h2>
              <button onClick={addItem} className="inline-flex items-center gap-1.5 text-sm bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-lg font-medium">
                <Plus className="w-4 h-4" /> Add item
              </button>
            </div>

            <div className="space-y-2">
              {/* header row */}
              <div className="hidden md:grid grid-cols-12 gap-2 px-1 text-xs uppercase tracking-wide text-gray-400">
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-2 text-right">Unit Price</div>
                <div className="col-span-2 text-right pr-9">Amount</div>
              </div>

              {computed.withAmount.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input className={`${fieldCls} col-span-12 md:col-span-6`} placeholder="Item description" value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} />
                  <input type="number" min={0} className={`${fieldCls} col-span-4 md:col-span-2 text-center`} value={it.qty} onChange={(e) => updateItem(i, { qty: Number(e.target.value) })} />
                  <input type="number" min={0} step="0.01" className={`${fieldCls} col-span-4 md:col-span-2 text-right`} value={it.unitPrice} onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) })} />
                  <div className="col-span-3 md:col-span-1 text-right text-sm font-medium tabular-nums">{money(it.amount)}</div>
                  <button onClick={() => removeItem(i)} className="col-span-1 justify-self-end text-gray-400 hover:text-red-500 disabled:opacity-30" disabled={items.length === 1} title="Remove">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <textarea className={fieldCls} placeholder="Notes (terms, delivery time, etc.)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </section>
        </div>

        {/* ---- Totals / actions ---- */}
        <div className="space-y-6">
          <section className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5 sticky top-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Summary</h2>

            <div className="flex justify-between text-sm py-2">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium tabular-nums">Rs {money(computed.subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-sm py-2">
              <span className="text-gray-500">Discount</span>
              <input type="number" min={0} step="0.01" className={`${fieldCls} w-32 text-right py-1.5`} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            </div>
            <div className="flex justify-between items-center text-sm py-2">
              <span className="text-gray-500">Other charges</span>
              <input type="number" min={0} step="0.01" className={`${fieldCls} w-32 text-right py-1.5`} value={otherCharge} onChange={(e) => setOtherCharge(Number(e.target.value))} />
            </div>
            <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 mt-2 pt-3">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-primary tabular-nums">Rs {money(computed.grandTotal)}</span>
            </div>

            <div className="mt-5 space-y-2">
              <button onClick={handleSave} disabled={saving} className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : "Save Quotation"}
              </button>
              <button onClick={handleDownloadCurrent} className="w-full bg-gray-100 dark:bg-gray-900/40 hover:bg-gray-200 dark:hover:bg-gray-900/70 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                <Download className="w-4 h-4" /> Download PDF
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* ---- Recent ---- */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Recent Quotations</h2>
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          {loading ? (
            <p className="p-5 text-sm text-gray-500">Loading…</p>
          ) : quotes.length === 0 ? (
            <p className="p-5 text-sm text-gray-500">No saved quotations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="p-3 text-left">Ref</th>
                    <th className="p-3 text-left">Customer</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-left">Valid Until</th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.Id} className="border-t border-gray-100 dark:border-gray-700/60">
                      <td className="p-3 font-medium">{q.QuoteRef}</td>
                      <td className="p-3">{q.CustomerName || "—"}</td>
                      <td className="p-3 text-right tabular-nums">Rs {money(Number(q.GrandTotal))}</td>
                      <td className="p-3">{q.ValidUntil ? new Date(q.ValidUntil).toLocaleDateString() : "—"}</td>
                      <td className="p-3">{new Date(q.CreatedAt).toLocaleDateString()}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleDownloadSaved(q)} disabled={downloadingId === q.Id} className="inline-flex items-center gap-1 text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg disabled:opacity-50" title="Download PDF">
                            {downloadingId === q.Id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          </button>
                          <button onClick={() => handleDelete(q.Id)} className="text-gray-400 hover:text-red-500 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10" title="Delete">
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
        </div>
      </section>
    </div>
  );
}
