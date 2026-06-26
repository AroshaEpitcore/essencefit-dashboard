"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import { Landmark, Truck, Upload, Check } from "lucide-react";
import { useCart } from "@/components/shop/CartContext";
import Select from "@/components/shop/Select";
import { money } from "@/components/shop/format";
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

const input = "w-full bg-white border border-gray-300  px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40";

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
      const { orderId } = await createWebOrder({
        ...f,
        paymentMethod: method,
        paymentSlipUrl: slipUrl,
        password: !loggedIn ? password : undefined,
        items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
      });
      clear();
      router.push(`/order/${orderId}?placed=1`);
      router.refresh(); // re-render the (shop) layout so the navbar reflects the new session
    } catch (e: any) {
      toast.error(e.message || "Could not place order");
      setPlacing(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Toaster position="top-center" />
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8">
        {/* Form */}
        <div className="space-y-6">
          <section className="bg-white border border-gray-200  p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Delivery details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <input className={input} placeholder="Full name *" value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} />
              <input className={input} placeholder="Phone number *" value={f.customerPhone} onChange={(e) => setF({ ...f, customerPhone: e.target.value })} />
              <input className={input} placeholder="Secondary phone (optional)" value={f.secondaryPhone} onChange={(e) => setF({ ...f, secondaryPhone: e.target.value })} />
              <input className={input} placeholder="Email (optional)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              {config && config.deliveryProvinces.length > 0 && (
                <Select
                  ariaLabel="Province"
                  placeholder="Select province *"
                  value={f.province}
                  onChange={(v) => setF({ ...f, province: v })}
                  triggerClassName={`${input} flex items-center justify-between gap-2 text-left`}
                  options={config.deliveryProvinces.map((p) => ({ value: p.name, label: `${p.name} — ${money(p.fee)}` }))}
                />
              )}
              <textarea className={`${input} sm:col-span-2 resize-none`} rows={3} placeholder="Delivery address *" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
              <textarea className={`${input} sm:col-span-2 resize-none`} rows={2} placeholder="Order notes (optional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </div>
          </section>

          {loggedIn && (
            <section className="bg-primary/5 border border-primary/20 p-4 flex items-center justify-between gap-3">
              <p className="text-sm text-gray-700">
                Signed in as <b className="text-gray-900">{meName}</b>. This order will be saved to your account.
              </p>
              <button onClick={switchAccount} className="text-sm font-medium text-primary hover:underline shrink-0">
                Not you? Log out
              </button>
            </section>
          )}

          {!loggedIn && (
            <section className="bg-white border border-gray-200  p-5">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">Create an account to track your order</span>
                <Link href="/account/login?next=/checkout" className="text-sm text-primary font-medium hover:underline">
                  Already have an account? Log in
                </Link>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                We&apos;ll save your details so you can sign in (with your phone or email) and follow your order anytime.
              </p>
              <input
                className={input}
                type="password"
                placeholder="Choose a password (min 6 characters) *"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </section>
          )}

          <section className="bg-white border border-gray-200  p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Payment method</h2>
            <div className="space-y-3">
              <button onClick={() => setMethod("COD")} className={`w-full flex items-center gap-3 border  p-4 text-left ${method === "COD" ? "border-primary bg-primary/5" : "border-gray-300"}`}>
                <Truck className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Cash on delivery</p>
                  <p className="text-sm text-gray-500">Pay with cash when your order arrives.</p>
                </div>
                {method === "COD" && <Check className="w-5 h-5 text-primary" />}
              </button>

              <button onClick={() => setMethod("BankTransfer")} className={`w-full flex items-center gap-3 border  p-4 text-left ${method === "BankTransfer" ? "border-primary bg-primary/5" : "border-gray-300"}`}>
                <Landmark className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Bank transfer</p>
                  <p className="text-sm text-gray-500">Transfer to our account and upload the slip.</p>
                </div>
                {method === "BankTransfer" && <Check className="w-5 h-5 text-primary" />}
              </button>
            </div>

            {method === "BankTransfer" && config && (
              <div className="mt-4 bg-gray-50  p-4 text-sm">
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
                <label className="mt-3 inline-flex items-center gap-2 px-4 py-2  bg-gray-900 text-white cursor-pointer text-sm font-medium hover:bg-gray-800">
                  <Upload className="w-4 h-4" /> {uploading ? "Uploading..." : slipUrl ? "Slip uploaded ✓" : "Upload deposit slip *"}
                  <input type="file" accept="image/*" hidden onChange={(e) => onSlip(e.target.files?.[0] || null)} />
                </label>
              </div>
            )}
          </section>
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-24 h-max bg-gray-50 border border-gray-200  p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Your order</h2>
          <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
            {items.map((it) => (
              <div key={it.variantId} className="flex gap-3 text-sm">
                <div className="w-12 h-12  bg-gray-100 overflow-hidden shrink-0">
                  {it.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image} alt="" className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 line-clamp-1">{it.name}</p>
                  <p className="text-gray-400 text-xs">{[it.size, it.color].filter(Boolean).join(" / ")} × {it.qty}</p>
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
            <div className="flex justify-between text-base border-t border-gray-200 pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-bold">{deliveryKnown ? money(total) : `${money(total)}+`}</span>
            </div>
          </div>
          <button onClick={place} disabled={placing} className="mt-5 w-full bg-primary text-white py-3  font-semibold hover:bg-primary/90 disabled:opacity-50">
            {placing ? "Placing order..." : "Place order"}
          </button>
          <Link href="/cart" className="mt-2 block text-center text-sm text-gray-500 hover:text-primary">Back to cart</Link>
        </div>
      </div>
    </div>
  );
}
