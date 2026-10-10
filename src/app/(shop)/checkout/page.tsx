"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import { Landmark, Truck, Upload, Check, ShoppingBag, ArrowRight, RefreshCw } from "lucide-react";
import { useCart } from "@/components/shop/CartContext";
import Select from "@/components/shop/Select";
import { LabeledInput, LabeledTextarea } from "@/components/shop/LabeledInput";
import { money } from "@/components/shop/format";
import { formatPhone, cleanPhoneInput } from "@/lib/phoneMask";
import { sizeLabel } from "@/lib/sizeOrder";
import { getCheckoutConfig, createWebOrder, type CheckoutConfig } from "./actions";
import { getMyAccount, logoutCustomer } from "../account/actions";

async function uploadSlip(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", "slips");
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.url as string;
}

/* Professional, Keychain-style strong password suggestions, e.g. "k9mx-R2p-tqw":
   mixed case + digits, grouped with hyphens, with ambiguous characters
   (l/1/I, o/0) removed so they're still easy to read and type. Random, so
   these are generated on the client (in an effect, never during render) to
   avoid a hydration mismatch. */
const PW_LOWER = "abcdefghijkmnpqrstuvwxyz"; // no l, o
const PW_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O
const PW_DIGITS = "23456789"; // no 0, 1
function makeStrongPassword(): string {
  const r = (s: string) => s[Math.floor(Math.random() * s.length)];
  const base = PW_LOWER + PW_DIGITS;
  const chars = Array.from({ length: 10 }, () => r(base));
  // Guarantee at least one uppercase and one digit, at random positions.
  chars[Math.floor(Math.random() * 10)] = r(PW_UPPER);
  chars[Math.floor(Math.random() * 10)] = r(PW_DIGITS);
  const s = chars.join("");
  return `${s.slice(0, 4)}-${s.slice(4, 7)}-${s.slice(7, 10)}`;
}
function makePasswordSuggestions(count = 3): string[] {
  const out = new Set<string>();
  let guard = 0;
  while (out.size < count && guard++ < 50) out.add(makeStrongPassword());
  return Array.from(out);
}

/* One extra suggestion built from the shopper's own details (first name +
   last 4 phone digits + a symbol, e.g. "Kevin@4567") — easy to remember.
   Deterministic, so it's safe to compute during render. Returns null until
   there's enough to make a >=6 char password. */
function derivePasswordFromDetails(name: string, phone: string): string | null {
  const first = (name.trim().split(/\s+/)[0] || "").replace(/[^a-zA-Z]/g, "");
  const digits = (phone || "").replace(/\D/g, "");
  if (first.length < 2 || digits.length < 3) return null;
  const cap = first[0].toUpperCase() + first.slice(1).toLowerCase();
  const pw = `${cap}@${digits.slice(-4)}`;
  return pw.length >= 6 ? pw : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const selectTrigger =
  "w-full flex items-center justify-between gap-2 bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-left text-gray-900 hover:border-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";

function StepBadge({ n }: { n: number }) {
  return (
    <span className="w-7 h-7 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center shrink-0">
      {n}
    </span>
  );
}

export default function CheckoutPage() {
  const { items, subtotal, clear, ready } = useCart();
  const router = useRouter();
  const [config, setConfig] = useState<CheckoutConfig | null>(null);

  const [f, setF] = useState({ customer: "", customerPhone: "", secondaryPhone: "", address: "", province: "", email: "", notes: "" });
  const [method, setMethod] = useState<"COD" | "BankTransfer">("COD");
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [meName, setMeName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => { getCheckoutConfig().then(setConfig).catch(() => {}); }, []);

  // Prefill from the signed-in account, if any
  useEffect(() => {
    getMyAccount().then((me) => {
      if (me) {
        setLoggedIn(true);
        setMeName(me.Name || "");
        setF((prev) => ({
          ...prev,
          customer: prev.customer || me.Name || "",
          customerPhone: prev.customerPhone || me.Phone || "",
          address: prev.address || me.Address || "",
          email: prev.email || me.Email || "",
        }));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready || items.length > 0 || placing) return;
    // One extra tick before bouncing to /cart — on a fresh navigation the
    // cart can render empty for a single frame before its own effects
    // settle, and redirecting on that transient frame would wrongly kick a
    // shopper who does have items back to their cart.
    const t = setTimeout(() => {
      if (items.length === 0 && !placing) router.replace("/cart");
    }, 150);
    return () => clearTimeout(t);
  }, [ready, items.length, placing, router]);

  const provinceFee = config?.deliveryProvinces.find((p) => p.name === f.province)?.fee;
  const hasProvinces = !!config && config.deliveryProvinces.length > 0;
  const provinceChosen = !hasProvinces || !!f.province;
  const baseFee = provinceFee != null ? provinceFee : config?.deliveryFee ?? 0;
  // Free delivery only when the admin threshold is set AND met — never just because no province is picked yet.
  const freeApplies = !!config && config.freeDeliveryOver > 0 && subtotal >= config.freeDeliveryOver;
  // Until the province is chosen the fee is unknown, so don't count it (and don't call it "Free").
  const deliveryFee = freeApplies ? 0 : provinceChosen ? baseFee : 0;
  const deliveryKnown = freeApplies || provinceChosen;
  const total = subtotal + deliveryFee;

  // Per-field validation errors (shown inline, not as toasts).
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const clearErr = (k: string) => setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));

  // Strong random suggestions — generated on the client only (random).
  const [randomSuggestions, setRandomSuggestions] = useState<string[]>([]);
  useEffect(() => {
    if (!loggedIn) setRandomSuggestions(makePasswordSuggestions(3));
  }, [loggedIn]);
  // Final list: one easy password built from their details first (if any),
  // then strong random ones — capped at 3.
  const passwordSuggestions = useMemo(() => {
    const derived = derivePasswordFromDetails(f.customer, f.customerPhone);
    return Array.from(new Set([...(derived ? [derived] : []), ...randomSuggestions])).slice(0, 3);
  }, [f.customer, f.customerPhone, randomSuggestions]);

  async function switchAccount() {
    await logoutCustomer();
    setLoggedIn(false);
    setMeName("");
    setF({ customer: "", customerPhone: "", secondaryPhone: "", address: "", province: "", email: "", notes: "" });
    router.refresh(); // update the navbar account control
    toast.success("Logged out — you can checkout as a new customer.");
  }

  async function onSlip(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      setSlipUrl(await uploadSlip(file));
      toast.success("Slip uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // Maps each error key to the DOM id to scroll to, in top-to-bottom order.
  const ERROR_FIELD_IDS: Array<[string, string]> = [
    ["customer", "checkout-name"],
    ["customerPhone", "checkout-phone"],
    ["email", "checkout-email"],
    ["province", "checkout-province"],
    ["address", "checkout-address"],
    ["password", "checkout-password"],
    ["slip", "checkout-slip"],
  ];

  async function place() {
    const errs: Record<string, string> = {};
    if (!f.customer.trim()) errs.customer = "Please enter your name.";
    if (!f.customerPhone.trim()) errs.customerPhone = "Please enter your phone number.";
    if (!f.email.trim()) errs.email = "Please enter your email.";
    else if (!EMAIL_RE.test(f.email.trim())) errs.email = "Please enter a valid email address.";
    if (config && config.deliveryProvinces.length > 0 && !f.province) errs.province = "Please select your province.";
    if (!f.address.trim()) errs.address = "Please enter your delivery address.";
    if (!loggedIn && (!password || password.trim().length < 6)) {
      errs.password = "Choose a password with at least 6 characters.";
    }
    if (method === "BankTransfer" && !slipUrl) errs.slip = "Please upload your bank transfer slip.";

    if (Object.keys(errs).length) {
      setErrors(errs);
      // Scroll to (and focus) the first invalid field, top-to-bottom.
      const firstId = ERROR_FIELD_IDS.find(([key]) => errs[key])?.[1];
      if (firstId) {
        const el = document.getElementById(firstId);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => (el as HTMLElement | null)?.focus?.({ preventScroll: true }), 300);
      }
      return;
    }
    setErrors({});

    setPlacing(true);
    try {
      const res = await createWebOrder({
        ...f,
        paymentMethod: method,
        paymentSlipUrl: slipUrl,
        password: !loggedIn ? password : undefined,
        items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
      });
      if (!res.ok) {
        // Expected rejections (sold out, validation) come back as data — a
        // thrown error would reach us with its message masked in production.
        toast.error(res.error);
        setPlacing(false);
        return;
      }
      clear();
      // Full navigation on purpose: router.push + router.refresh() here raced —
      // the refresh cancelled the in-flight push and left the buyer stuck on
      // "Placing order..." even though the order was created. A document load
      // both commits reliably and re-renders the navbar with the new session.
      window.location.assign(`/order/${res.orderId}?placed=1`);
    } catch {
      toast.error("Could not place order — please try again.");
      setPlacing(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Toaster position="top-center" />
      <div className="flex items-center gap-3 mb-1">
        <ShoppingBag className="w-7 h-7 text-primary" />
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Checkout</h1>
      </div>
      <p className="text-gray-500 mb-8">Almost there — fill in your details to complete the order.</p>

      <div className="grid lg:grid-cols-[1fr_380px] gap-8">
        {/* Form (a real <form> so browsers offer to generate & save a strong
            password; the Place-order button sits outside it, so Enter here
            never submits). */}
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()} autoComplete="on">
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <StepBadge n={1} />
              <h2 className="text-lg font-bold text-gray-900">Delivery details</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <LabeledInput
                id="checkout-name" label="Full name (සම්පූර්ණ නම) *" autoComplete="name" error={errors.customer}
                value={f.customer} onChange={(e) => { setF({ ...f, customer: e.target.value }); clearErr("customer"); }}
              />
              <LabeledInput
                id="checkout-phone" label="Phone number (දුරකථන අංකය) *" type="tel" inputMode="numeric" required autoComplete="tel username" error={errors.customerPhone}
                value={formatPhone(f.customerPhone)} onChange={(e) => { setF({ ...f, customerPhone: cleanPhoneInput(e.target.value) }); clearErr("customerPhone"); }}
              />
              <LabeledInput
                id="checkout-phone2" label="Secondary phone (දෙවන දුරකථන අංකය) (optional)" type="tel" inputMode="numeric" autoComplete="tel"
                value={formatPhone(f.secondaryPhone)} onChange={(e) => setF({ ...f, secondaryPhone: cleanPhoneInput(e.target.value) })}
              />
              <LabeledInput
                id="checkout-email" label="Email (ඊමේල්) *" type="email" autoComplete="email" error={errors.email}
                value={f.email} onChange={(e) => { setF({ ...f, email: e.target.value }); clearErr("email"); }}
              />
              {config && config.deliveryProvinces.length > 0 && (
                <div id="checkout-province">
                  <label className={`block text-sm font-medium mb-1.5 ${errors.province ? "text-red-600" : "text-gray-700"}`}>Province (පළාත) *</label>
                  <Select
                    ariaLabel="Province"
                    placeholder="Select province"
                    value={f.province}
                    onChange={(v) => { setF({ ...f, province: v }); clearErr("province"); }}
                    triggerClassName={errors.province ? selectTrigger.replace("border-gray-300", "border-red-500") : selectTrigger}
                    options={config.deliveryProvinces.map((p) => ({ value: p.name, label: `${p.name} — ${money(p.fee)}` }))}
                  />
                  {errors.province && <p className="mt-1 text-xs font-medium text-red-600">{errors.province}</p>}
                </div>
              )}
              <LabeledTextarea
                id="checkout-address" label="Delivery address (බෙදාහැරීමේ ලිපිනය) *" rows={3} containerClassName="sm:col-span-2" autoComplete="street-address" error={errors.address}
                value={f.address} onChange={(e) => { setF({ ...f, address: e.target.value }); clearErr("address"); }}
              />
              <LabeledTextarea
                id="checkout-notes" label="Order notes (ඇණවුම් සටහන්) (optional)" rows={2} containerClassName="sm:col-span-2"
                value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })}
              />
            </div>
          </section>

          {loggedIn && (
            <section className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between gap-3">
              <p className="text-sm text-gray-700">
                Signed in as <b className="text-gray-900">{meName}</b>. This order will be saved to your account.
              </p>
              <button onClick={switchAccount} className="text-sm font-medium text-primary hover:underline shrink-0">
                Not you? Log out
              </button>
            </section>
          )}

          {!loggedIn && (
            <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">Create an account to track your order</span>
                <Link href="/account/login?next=/checkout" className="text-sm text-primary font-medium hover:underline">
                  Already have an account? Log in
                </Link>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                We&apos;ll save your details so you can sign in (with your phone or email) and follow your order anytime.
              </p>
              <LabeledInput
                id="checkout-password" label="Choose a password (මුරපදයක් තෝරන්න — අවම අකුරු 6ක්) *" type="password"
                autoComplete="new-password" error={errors.password}
                placeholder="e.g. essence123 (උදා: essence123)"
                value={password} onChange={(e) => { setPassword(e.target.value); clearErr("password"); }}
              />
              {passwordSuggestions.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="text-xs text-gray-500">
                      Suggestions — tap to use (යෝජිත මුරපද — තට්ටු කර භාවිතා කරන්න)
                    </p>
                    <button
                      type="button"
                      onClick={() => setRandomSuggestions(makePasswordSuggestions(3))}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <RefreshCw className="w-3 h-3" /> New
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {passwordSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { setPassword(s); toast.success("Password filled — remember it!"); }}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                          password === s
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-gray-300 text-gray-700 hover:border-primary hover:text-primary"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <StepBadge n={2} />
              <h2 className="text-lg font-bold text-gray-900">Payment method</h2>
            </div>
            <div className="space-y-3">
              <button onClick={() => setMethod("COD")} className={`w-full flex items-center gap-3 border-2 rounded-lg p-4 text-left transition-colors ${method === "COD" ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-gray-200 hover:border-gray-300"}`}>
                <Truck className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Cash on delivery</p>
                  <p className="text-sm text-gray-500">Pay with cash when your order arrives.</p>
                </div>
                {method === "COD" && <Check className="w-5 h-5 text-primary" />}
              </button>

              <button onClick={() => setMethod("BankTransfer")} className={`w-full flex items-center gap-3 border-2 rounded-lg p-4 text-left transition-colors ${method === "BankTransfer" ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-gray-200 hover:border-gray-300"}`}>
                <Landmark className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Bank transfer</p>
                  <p className="text-sm text-gray-500">Transfer to our account and upload the slip.</p>
                </div>
                {method === "BankTransfer" && <Check className="w-5 h-5 text-primary" />}
              </button>
            </div>

            {method === "BankTransfer" && config && (
              <div id="checkout-slip" className={`mt-4 bg-gray-50 rounded-lg p-4 text-sm ${errors.slip ? "ring-1 ring-red-500" : ""}`}>
                <p className="font-medium text-gray-900 mb-2">Bank details</p>
                {config.bank.bank ? (
                  <ul className="text-gray-600 space-y-0.5">
                    <li>Bank: <b>{config.bank.bank}</b></li>
                    <li>Account name: <b>{config.bank.accountName}</b></li>
                    <li>Account no: <b>{config.bank.accountNo}</b></li>
                    {config.bank.branch && <li>Branch: <b>{config.bank.branch}</b></li>}
                  </ul>
                ) : (
                  <p className="text-gray-500">Bank details will be shared by our team.</p>
                )}
                <label className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white cursor-pointer text-sm font-medium hover:bg-gray-800">
                  <Upload className="w-4 h-4" /> {uploading ? "Uploading..." : slipUrl ? "Slip uploaded ✓" : "Upload deposit slip *"}
                  <input type="file" accept="image/*" hidden onChange={(e) => { onSlip(e.target.files?.[0] || null); clearErr("slip"); }} />
                </label>
                {errors.slip && <p className="mt-2 text-xs font-medium text-red-600">{errors.slip}</p>}
              </div>
            )}
          </section>
        </form>

        {/* Summary */}
        <div className="lg:sticky lg:top-24 h-max bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Your order</h2>
          <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
            {items.map((it) => (
              <div key={it.variantId} className="flex gap-3 text-sm">
                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                  {it.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 line-clamp-1">{it.name}</p>
                  <p className="text-gray-400 text-xs">{[sizeLabel(it.size), it.color].filter(Boolean).join(" / ")} × {it.qty}</p>
                </div>
                <span className="font-medium">{money(it.price * it.qty)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 text-sm border-t border-gray-200 pt-3">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Delivery</span>
              {freeApplies ? (
                <span className="font-semibold text-green-600">Free</span>
              ) : !provinceChosen ? (
                <span className="text-xs text-gray-400">Select province to calculate</span>
              ) : (
                <span>{money(deliveryFee)}</span>
              )}
            </div>
            {!freeApplies && config && config.freeDeliveryOver > 0 && subtotal < config.freeDeliveryOver && (
              <p className="text-xs text-primary">
                Add {money(config.freeDeliveryOver - subtotal)} more for free delivery.
              </p>
            )}
          </div>
          <div className="flex justify-between items-baseline mt-3 pt-3 border-t border-gray-200">
            <span className="text-base font-bold text-gray-900">Total</span>
            <span className="text-2xl font-extrabold text-primary">{deliveryKnown ? money(total) : `${money(total)}+`}</span>
          </div>
          <button onClick={place} disabled={placing} className="mt-5 w-full bg-primary text-white py-3.5 rounded-lg font-bold text-base flex items-center justify-center gap-2 shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:active:scale-100">
            {placing ? "Placing order..." : (<>Place order <ArrowRight className="w-4 h-4" /></>)}
          </button>
          <Link href="/cart" className="mt-3 block text-center text-sm text-gray-500 hover:text-primary">Back to cart</Link>
        </div>
      </div>
    </div>
  );
}
