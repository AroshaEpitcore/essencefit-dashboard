"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import { Landmark, Truck, Upload, Check, ShoppingBag, ArrowRight } from "lucide-react";
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
    if (ready && items.length === 0 && !placing) router.replace("/cart");
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

  async function place() {
    if (!f.customer.trim()) return toast.error("Please enter your name.");
    if (!f.customerPhone.trim()) return toast.error("Please enter your phone number.");
    if (config && config.deliveryProvinces.length > 0 && !f.province) return toast.error("Please select your province.");
    if (!f.address.trim()) return toast.error("Please enter your delivery address.");
    if (method === "BankTransfer" && !slipUrl) return toast.error("Please upload your bank transfer slip.");
    if (!loggedIn && (!password || password.trim().length < 6)) {
      return toast.error("Please choose a password (at least 6 characters) to create your account, or log in.");
    }

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
        {/* Form */}
        <div className="space-y-6">
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <StepBadge n={1} />
              <h2 className="text-lg font-bold text-gray-900">Delivery details</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <LabeledInput
                id="checkout-name" label="Full name *"
                value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })}
              />
              <LabeledInput
                id="checkout-phone" label="Phone number *" type="tel" inputMode="numeric" required
                value={formatPhone(f.customerPhone)} onChange={(e) => setF({ ...f, customerPhone: cleanPhoneInput(e.target.value) })}
              />
              <LabeledInput
                id="checkout-phone2" label="Secondary phone (optional)" type="tel" inputMode="numeric"
                value={formatPhone(f.secondaryPhone)} onChange={(e) => setF({ ...f, secondaryPhone: cleanPhoneInput(e.target.value) })}
              />
              <LabeledInput
                id="checkout-email" label="Email (optional)" type="email"
                value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })}
              />
              {config && config.deliveryProvinces.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Province *</label>
                  <Select
                    ariaLabel="Province"
                    placeholder="Select province"
                    value={f.province}
                    onChange={(v) => setF({ ...f, province: v })}
                    triggerClassName={selectTrigger}
                    options={config.deliveryProvinces.map((p) => ({ value: p.name, label: `${p.name} — ${money(p.fee)}` }))}
                  />
                </div>
              )}
              <LabeledTextarea
                id="checkout-address" label="Delivery address *" rows={3} containerClassName="sm:col-span-2"
                value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })}
              />
              <LabeledTextarea
                id="checkout-notes" label="Order notes (optional)" rows={2} containerClassName="sm:col-span-2"
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
                id="checkout-password" label="Choose a password (min 6 characters) *" type="password"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
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
              <div className="mt-4 bg-gray-50 rounded-lg p-4 text-sm">
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
                  <input type="file" accept="image/*" hidden onChange={(e) => onSlip(e.target.files?.[0] || null)} />
                </label>
              </div>
            )}
          </section>
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-24 h-max bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Your order</h2>
          <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
            {items.map((it) => (
              <div key={it.variantId} className="flex gap-3 text-sm">
                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                  {it.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image} alt="" className="w-full h-full object-cover" />
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
