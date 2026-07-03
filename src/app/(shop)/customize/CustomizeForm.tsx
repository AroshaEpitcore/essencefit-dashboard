"use client";

import { useState } from "react";
import Link from "next/link";
import { Upload, X, FileText, MessageCircle, Check, Loader2, Lightbulb } from "lucide-react";
import type { StoreProduct, StoreVariant } from "@/lib/storefront";
import type { DtfPricingConfig } from "@/lib/dtfPricing";
import type { DtfPageSettings } from "@/lib/dtfSettings";
import { sizeRank } from "@/components/shop/format";
import { resolveSwatch, cutLineColor } from "@/lib/colorHex";
import { LabeledInput, LabeledTextarea } from "@/components/shop/LabeledInput";
import { cleanPhoneInput } from "@/lib/phoneMask";
import { createDtfOrder, getGarmentVariants, type DtfDesignInput } from "./actions";

type AccountInfo = { name: string; phone: string | null; email: string | null } | null;

function uniqBy<T>(arr: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  return arr.filter((x) => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Diagonal "cut" line for sold-out options (matches the PDP).
function CutLine({ hex }: { hex: string | null }) {
  const c = cutLineColor(hex);
  return (
    <span
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `linear-gradient(45deg, transparent calc(50% - 0.75px), ${c} calc(50% - 0.75px), ${c} calc(50% + 0.75px), transparent calc(50% + 0.75px))`,
      }}
    />
  );
}

export default function CustomizeForm({
  products,
  pricing,
  settings,
  account,
}: {
  products: StoreProduct[];
  pricing: DtfPricingConfig;
  settings: DtfPageSettings;
  account: AccountInfo;
}) {
  const loggedIn = !!account;
  const [productId, setProductId] = useState("");
  const [variants, setVariants] = useState<StoreVariant[]>([]);
  const [colorId, setColorId] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [prints, setPrints] = useState<string[]>([]);
  const [designs, setDesigns] = useState<DtfDesignInput[]>([]);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");

  const [name, setName] = useState(account?.name ?? "");
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState(account?.email ?? "");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ id: string; ref: string } | null>(null);

  const product = products.find((p) => p.Id === productId) || null;

  // Colour + size selection (mirrors the PDP). Resolve to a single variant.
  const hasColors = variants.some((v) => v.ColorId);
  const hasSizes = variants.some((v) => v.SizeId);
  const allColors = uniqBy(variants.filter((v) => v.ColorId), (v) => v.ColorId!).map((v) => ({
    id: v.ColorId!, name: v.ColorName || "", hex: v.ColorHex,
  }));
  const allSizes = uniqBy(variants.filter((v) => v.SizeId), (v) => v.SizeId!)
    .map((v) => ({ id: v.SizeId!, name: v.SizeName || "" }))
    .sort((a, b) => sizeRank(a.name) - sizeRank(b.name));

  const colorAvailable = (cid: string) =>
    variants.some((v) => v.ColorId === cid && (!hasSizes || !sizeId || v.SizeId === sizeId) && v.Qty > 0);
  const sizeAvailable = (sid: string) =>
    variants.some((v) => v.SizeId === sid && (!hasColors || !colorId || v.ColorId === colorId) && v.Qty > 0);

  const variant =
    variants.find((v) => (!hasColors || v.ColorId === colorId) && (!hasSizes || v.SizeId === sizeId)) || null;
  const variantId = variant?.VariantId || "";

  const waNumber = (settings.whatsapp || "").replace(/[^\d]/g, "");

  async function onPickProduct(id: string) {
    setProductId(id === productId ? "" : id);
    setColorId(null);
    setSizeId(null);
    setVariants([]);
    if (!id || id === productId) return;
    try {
      const g = await getGarmentVariants(id);
      setVariants(g.variants);
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
    if (hasColors && !colorId) return setError("Please choose a colour.");
    if (hasSizes && !sizeId) return setError("Please choose a size.");
    if (!designs.length) return setError("Please upload at least one design.");
    if (!name.trim()) return setError("Please enter your name.");
    if (!phone.trim()) return setError("Please enter a phone number.");
    if (!loggedIn && (!password || password.trim().length < 6)) {
      return setError("Please choose a password (at least 6 characters) to create your account, or log in.");
    }

    setSubmitting(true);
    try {
      const { id, ref } = await createDtfOrder({
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
        password: loggedIn ? undefined : password,
      });
      setSuccess({ id, ref });
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
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Link
            href={`/dtf-order/${success.id}`}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-semibold"
          >
            Track my order
          </Link>
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Hi, about my DTF order ${success.ref}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-green-600 text-green-700 hover:bg-green-50 px-6 py-3 rounded-lg font-semibold"
            >
              <MessageCircle className="w-5 h-5" /> Chat on WhatsApp
            </a>
          )}
        </div>
        <div className="mt-4 flex gap-4 justify-center text-sm">
          <Link href="/account/orders" className="font-medium text-primary">View in My Account</Link>
          <Link href="/shop" className="font-medium text-gray-500 hover:text-primary">Continue shopping →</Link>
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
        <section className="border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-3">1. Choose your garment</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {products.map((p) => {
              const sel = productId === p.Id;
              return (
                <button
                  key={p.Id}
                  type="button"
                  onClick={() => onPickProduct(p.Id)}
                  className={`text-left border-2 rounded-lg p-2 transition-[border-color] ${sel ? "border-gray-900" : "border-gray-200 hover:border-gray-400"}`}
                >
                  <div className="aspect-square rounded-lg bg-gray-100 overflow-hidden mb-2">
                    {p.ImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.ImageUrl} alt={p.Name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No image</div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{p.Name}</p>
                </button>
              );
            })}
          </div>

          {/* COLOUR — same swatch UI as the product page */}
          {product && hasColors && (
            <div className="mt-5">
              <p className="text-xs font-semibold tracking-wide text-gray-700 mb-2">
                COLOUR{colorId ? `: ${allColors.find((c) => c.id === colorId)?.name ?? ""}` : ""}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {allColors.map((c) => {
                  const avail = colorAvailable(c.id);
                  const sw = resolveSwatch(c.name, c.hex);
                  const selected = colorId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={!avail}
                      title={c.name + (avail ? "" : " — sold out")}
                      onClick={() => setColorId(c.id)}
                      className={`relative w-11 h-11 rounded-sm border-2 overflow-hidden transition-[border-color] ${
                        selected ? "border-gray-900" : "border-gray-200"
                      } ${!avail ? "cursor-not-allowed opacity-70" : "hover:border-gray-400"}`}
                    >
                      <span
                        className="absolute inset-0"
                        style={sw.hex ? { backgroundColor: sw.hex } : { backgroundImage: "linear-gradient(135deg,#e5e7eb 0 50%,#9ca3af 50% 100%)" }}
                      />
                      {!avail && <CutLine hex={sw.hex} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SIZE — same button UI as the product page */}
          {product && hasSizes && (
            <div className="mt-5">
              <p className="text-xs font-semibold tracking-wide text-gray-700 mb-2">SIZE</p>
              <div className="flex flex-wrap gap-2.5">
                {allSizes.map((s) => {
                  const avail = sizeAvailable(s.id);
                  const selected = sizeId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={!avail}
                      title={s.name + (avail ? "" : " — sold out")}
                      onClick={() => setSizeId(s.id)}
                      className={`min-w-[3rem] h-11 px-3 rounded-full border-2 text-sm font-medium flex items-center justify-center transition-colors ${
                        !avail
                          ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
                          : selected
                          ? "border-gray-900 text-gray-900"
                          : "border-gray-200 text-gray-700 hover:border-gray-400"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {product && (
            <LabeledInput
              id="dtf-qty" label="Quantity" type="number" min={1}
              containerClassName="mt-5 w-32"
              value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            />
          )}
        </section>

        {/* 2. Print positions */}
        {pricing.prints.length > 0 && (
          <section className="border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-3">2. Print options</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {pricing.prints.map((p) => {
                const on = prints.includes(p.Name);
                return (
                  <button
                    key={p.Id}
                    type="button"
                    onClick={() => togglePrint(p.Name)}
                    className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                      on ? "border-primary bg-primary/10 text-primary" : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-medium block">{p.Name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 3. Designs */}
        <section className="border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-1">3. Upload your designs</h3>
          <p className="text-xs text-gray-500 mb-3">JPG, PNG, WEBP or PDF · up to 25MB each · add as many as you like.</p>
          <div className="flex flex-wrap gap-3">
            {designs.map((d, i) => (
              <div key={d.url + i} className="relative w-24 h-24 rounded-lg border border-gray-300 overflow-hidden bg-gray-50">
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
            <label className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary text-gray-400 hover:text-primary">
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
        <section className="border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-3">4. Your note</h3>
          <LabeledTextarea
            id="dtf-note" label="Your note" rows={3}
            placeholder="Tell us print placement, sizing, colours, or anything else…"
            value={note} onChange={(e) => setNote(e.target.value)}
          />
        </section>

        {/* 5. Contact details */}
        <section className="border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-3">5. Your details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LabeledInput id="dtf-name" label="Full name *" value={name} onChange={(e) => setName(e.target.value)} />
            <LabeledInput id="dtf-phone" label="Phone *" type="tel" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(cleanPhoneInput(e.target.value))} />
            <LabeledInput id="dtf-whatsapp" label="WhatsApp (optional)" type="tel" inputMode="numeric" maxLength={10} value={whatsapp} onChange={(e) => setWhatsapp(cleanPhoneInput(e.target.value))} />
            <LabeledInput id="dtf-email" label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <LabeledInput
              id="dtf-address" label="Delivery address (optional)"
              containerClassName="sm:col-span-2" value={address} onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          {loggedIn ? (
            <p className="mt-3 text-sm text-gray-500">Ordering as <b>{account!.name}</b> — you can track this in your account.</p>
          ) : (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Create an account to track your order</span>
                <Link href="/account/login?next=/customize" className="text-sm text-primary font-medium hover:underline">
                  Already have an account? Log in
                </Link>
              </div>
              <LabeledInput
                id="dtf-password" label="Choose a password (min 6 characters) *" type="password"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
        </section>
      </div>

      {/* Right: summary + estimate */}
      <aside className="space-y-4">
        <div className="border border-gray-200 rounded-xl p-5 lg:sticky lg:top-28">
          <h3 className="font-semibold text-gray-900 mb-3">Your request</h3>
          {product ? (
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between gap-3"><span className="text-gray-500">Garment</span><span className="text-gray-900 font-medium text-right">{product.Name}</span></div>
              {colorId && <div className="flex justify-between gap-3"><span className="text-gray-500">Colour</span><span className="text-gray-900 text-right">{allColors.find((c) => c.id === colorId)?.name}</span></div>}
              {sizeId && <div className="flex justify-between gap-3"><span className="text-gray-500">Size</span><span className="text-gray-900 text-right">{allSizes.find((s) => s.id === sizeId)?.name}</span></div>}
              <div className="flex justify-between gap-3"><span className="text-gray-500">Quantity</span><span className="text-gray-900 text-right">{Math.max(1, qty)}</span></div>
              {prints.length > 0 && <div className="flex justify-between gap-3"><span className="text-gray-500">Print</span><span className="text-gray-900 text-right">{prints.join(", ")}</span></div>}
              <div className="flex justify-between gap-3"><span className="text-gray-500">Designs</span><span className="text-gray-900 text-right">{designs.length} file{designs.length === 1 ? "" : "s"}</span></div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Choose a garment and upload your design to submit a request.</p>
          )}
          <p className="text-xs text-gray-500 mt-3">
            Submit your design and requirements — we&apos;ll review your artwork and get back to you with a quote.
          </p>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button
            onClick={submit}
            disabled={submitting || uploading}
            className="mt-4 w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {submitting ? "Submitting…" : "Submit request"}
          </button>

          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 w-full inline-flex items-center justify-center gap-2 border border-green-600 text-green-700 hover:bg-green-50 font-medium py-2.5 rounded-lg text-sm"
            >
              <MessageCircle className="w-4 h-4" /> Questions? WhatsApp us
            </a>
          )}
        </div>

        {settings.suggestions.length > 0 && (
          <div className="border border-gray-200 rounded-xl p-5">
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
