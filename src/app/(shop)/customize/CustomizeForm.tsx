"use client";

import { useState } from "react";
import Link from "next/link";
import { Upload, X, FileText, MessageCircle, Check, Loader2, Lightbulb } from "lucide-react";
import type { StoreProduct, StoreVariant } from "@/lib/storefront";
import type { DtfPricingConfig } from "@/lib/dtfPricing";
import type { DtfPageSettings } from "@/lib/dtfSettings";
import { money } from "@/components/shop/format";
import { createDtfOrder, getGarmentVariants, type DtfDesignInput } from "./actions";

export default function CustomizeForm({
  products,
  pricing,
  settings,
}: {
  products: StoreProduct[];
  pricing: DtfPricingConfig;
  settings: DtfPageSettings;
}) {
  const [productId, setProductId] = useState("");
  const [variants, setVariants] = useState<StoreVariant[]>([]);
  const [variantId, setVariantId] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [prints, setPrints] = useState<string[]>([]);
  const [designs, setDesigns] = useState<DtfDesignInput[]>([]);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ ref: string } | null>(null);

  const product = products.find((p) => p.Id === productId) || null;
  const variant = variants.find((v) => v.VariantId === variantId) || null;
  const garmentPrice = Number(variant?.SellingPrice ?? product?.SellingPrice ?? 0);

  const printSum = pricing.prints
    .filter((p) => prints.includes(p.Name))
    .reduce((s, p) => s + Number(p.Amount), 0);
  const perPiece = garmentPrice + printSum + pricing.overheadTotal + pricing.profit;
  const estimate = product ? perPiece * Math.max(1, qty) + pricing.orderExtra : 0;

  const waNumber = (settings.whatsapp || "").replace(/[^\d]/g, "");

  async function onPickProduct(id: string) {
    setProductId(id);
    setVariantId("");
    setVariants([]);
    if (!id) return;
    try {
      const vs = await getGarmentVariants(id);
      setVariants(vs);
    } catch {
      setVariants([]);
    }
  }

  function togglePrint(nameStr: string) {
    setPrints((prev) => (prev.includes(nameStr) ? prev.filter((p) => p !== nameStr) : [...prev, nameStr]));
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("folder", "designs");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setDesigns((prev) => [...prev, { url: data.url, kind: data.kind === "pdf" ? "pdf" : "image" }]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setError("");
    if (!product) return setError("Please choose a garment.");
    if (variants.length > 0 && !variantId) return setError("Please choose a size / colour.");
    if (!designs.length) return setError("Please upload at least one design.");
    if (!name.trim()) return setError("Please enter your name.");
    if (!phone.trim()) return setError("Please enter a phone number.");

    setSubmitting(true);
    try {
      const { ref } = await createDtfOrder({
        customerName: name,
        customerPhone: phone,
        whatsapp: whatsapp || undefined,
        email: email || undefined,
        address: address || undefined,
        productId: product.Id,
        variantId: variantId || null,
        qty: Math.max(1, qty),
        printNames: prints,
        customerNote: note || undefined,
        designs,
      });
      setSuccess({ ref });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not submit your request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Request received!</h2>
        <p className="mt-2 text-gray-600">
          Your customization request <b>{success.ref}</b> has been submitted. We&apos;ll review your
          artwork and confirm the final price with you shortly.
        </p>
        {waNumber && (
          <a
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Hi, about my DTF order ${success.ref}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3  font-semibold"
          >
            <MessageCircle className="w-5 h-5" /> Chat with us on WhatsApp
          </a>
        )}
        <div className="mt-4">
          <Link href="/shop" className="text-sm font-medium text-primary">Continue shopping →</Link>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-lg">No printable garments available yet.</p>
        <p className="text-sm mt-1">Please check back soon.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left: builder */}
      <div className="lg:col-span-2 space-y-6">
        {/* 1. Garment */}
        <section className="border border-gray-200  p-5">
          <h3 className="font-semibold text-gray-900 mb-3">1. Choose your garment</h3>
          <select
            value={productId}
            onChange={(e) => onPickProduct(e.target.value)}
            className="w-full border border-gray-300  px-3 py-2.5"
          >
            <option value="">Select a garment…</option>
            {products.map((p) => (
              <option key={p.Id} value={p.Id}>
                {p.Name} — {money(p.SellingPrice)}
              </option>
            ))}
          </select>

          {variants.length > 0 && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Size &amp; colour</label>
              <select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                className="w-full border border-gray-300  px-3 py-2.5"
              >
                <option value="">Select size / colour…</option>
                {variants.map((v) => (
                  <option key={v.VariantId} value={v.VariantId}>
                    {[v.SizeName, v.ColorName].filter(Boolean).join(" / ") || "Standard"}
                    {v.Qty > 0 ? "" : " — out of stock"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-3 w-32">
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className="w-full border border-gray-300  px-3 py-2.5"
            />
          </div>
        </section>

        {/* 2. Print positions */}
        {pricing.prints.length > 0 && (
          <section className="border border-gray-200  p-5">
            <h3 className="font-semibold text-gray-900 mb-3">2. Print options</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {pricing.prints.map((p) => {
                const on = prints.includes(p.Name);
                return (
                  <button
                    key={p.Id}
                    type="button"
                    onClick={() => togglePrint(p.Name)}
                    className={`px-3 py-2  border text-sm text-left transition-colors ${
                      on ? "border-primary bg-primary/10 text-primary" : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-medium block">{p.Name}</span>
                    <span className="text-xs opacity-70">+{money(p.Amount)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 3. Designs */}
        <section className="border border-gray-200  p-5">
          <h3 className="font-semibold text-gray-900 mb-1">3. Upload your designs</h3>
          <p className="text-xs text-gray-500 mb-3">JPG, PNG, WEBP or PDF · up to 25MB each · add as many as you like.</p>
          <div className="flex flex-wrap gap-3">
            {designs.map((d, i) => (
              <div key={d.url + i} className="relative w-24 h-24  border border-gray-300 overflow-hidden bg-gray-50">
                {d.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                    <FileText className="w-7 h-7" />
                    <span className="text-[10px] mt-1">PDF</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setDesigns((prev) => prev.filter((_, k) => k !== i))}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                  aria-label="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <label className="w-24 h-24  border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary text-gray-400 hover:text-primary">
              {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
              <span className="text-[10px] mt-1">{uploading ? "Uploading" : "Add"}</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                hidden
                onChange={(e) => onUpload(e.target.files)}
              />
            </label>
          </div>
        </section>

        {/* 4. Note */}
        <section className="border border-gray-200  p-5">
          <h3 className="font-semibold text-gray-900 mb-3">4. Your note</h3>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Tell us print placement, sizing, colours, or anything else…"
            className="w-full border border-gray-300  px-3 py-2.5 resize-none"
          />
        </section>

        {/* 5. Contact details */}
        <section className="border border-gray-200  p-5">
          <h3 className="font-semibold text-gray-900 mb-3">5. Your details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name *" className="border border-gray-300  px-3 py-2.5" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone *" className="border border-gray-300  px-3 py-2.5" />
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp (optional)" className="border border-gray-300  px-3 py-2.5" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="border border-gray-300  px-3 py-2.5" />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Delivery address (optional)" className="border border-gray-300  px-3 py-2.5 sm:col-span-2" />
          </div>
        </section>
      </div>

      {/* Right: summary + estimate */}
      <aside className="space-y-4">
        <div className="border border-gray-200  p-5 lg:sticky lg:top-28">
          <h3 className="font-semibold text-gray-900 mb-3">Estimate</h3>
          {product ? (
            <>
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-600">Garment</span>
                <span>{money(garmentPrice)}</span>
              </div>
              {pricing.prints.filter((p) => prints.includes(p.Name)).map((p) => (
                <div key={p.Id} className="flex justify-between text-sm py-1">
                  <span className="text-gray-600">Print — {p.Name}</span>
                  <span>+{money(p.Amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-600">Print overheads + handling</span>
                <span>+{money(pricing.overheadTotal + pricing.profit)}</span>
              </div>
              <div className="flex justify-between text-sm py-1 border-t border-gray-100 mt-1 pt-2">
                <span className="text-gray-600">Per piece × {Math.max(1, qty)}</span>
                <span>{money(perPiece * Math.max(1, qty))}</span>
              </div>
              {pricing.orderExtra > 0 && (
                <div className="flex justify-between text-sm py-1">
                  <span className="text-gray-600">Order extra</span>
                  <span>+{money(pricing.orderExtra)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg text-primary border-t border-gray-200 mt-2 pt-2">
                <span>Estimated total</span>
                <span>{money(estimate)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                This is an estimate — the final price may change after we review your artwork.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">Choose a garment to see your estimate.</p>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button
            onClick={submit}
            disabled={submitting || uploading}
            className="mt-4 w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3  disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {submitting ? "Submitting…" : "Submit request"}
          </button>

          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 w-full inline-flex items-center justify-center gap-2 border border-green-600 text-green-700 hover:bg-green-50 font-medium py-2.5  text-sm"
            >
              <MessageCircle className="w-4 h-4" /> Questions? WhatsApp us
            </a>
          )}
        </div>

        {settings.suggestions.length > 0 && (
          <div className="border border-gray-200  p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-primary" /> Our suggestions
            </h3>
            <ul className="space-y-2">
              {settings.suggestions.map((s, i) => (
                <li key={i} className="text-sm text-gray-600 flex gap-2">
                  <span className="text-primary">•</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
