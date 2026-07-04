"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/components/shop/CartContext";
import { money } from "@/components/shop/format";
import { sizeLabel } from "@/lib/sizeOrder";
import { getCheckoutConfig, type CheckoutConfig } from "../checkout/actions";

export default function CartPage() {
  const { items, updateQty, removeItem, subtotal, ready } = useCart();
  const [config, setConfig] = useState<CheckoutConfig | null>(null);

  useEffect(() => { getCheckoutConfig().then(setConfig).catch(() => {}); }, []);

  // Delivery depends on the province chosen at checkout, so the cart only shows
  // the subtotal — except when the order already qualifies for free delivery.
  const freeDelivery = !!config && config.freeDeliveryOver > 0 && subtotal >= config.freeDeliveryOver;
  const freeDeliveryProgress =
    config && config.freeDeliveryOver > 0 ? Math.min(100, (subtotal / config.freeDeliveryOver) * 100) : null;

  if (ready && items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-5">
          <ShoppingBag className="w-9 h-9 text-gray-300" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Your cart is empty</h1>
        <p className="text-gray-500 mb-8">Looks like you haven&apos;t added anything yet.</p>
        <Link href="/shop" className="inline-block bg-primary text-white px-8 py-3.5 rounded-lg font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-1">
        <ShoppingBag className="w-7 h-7 text-primary" />
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Shopping cart</h1>
      </div>
      <p className="text-gray-500 mb-8">{items.length} item{items.length !== 1 ? "s" : ""} in your cart</p>

      <div className="grid lg:grid-cols-[1fr_380px] gap-8">
        {/* Items */}
        <div className="space-y-4">
          {items.map((it) => (
            <div key={it.variantId} className="flex gap-4 bg-white border border-gray-200 rounded-xl shadow-sm p-4">
              <Link href={`/product/${it.slug}`} className="shrink-0">
                <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-lg overflow-hidden bg-gray-100">
                  {it.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                  ) : null}
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/product/${it.slug}`} className="font-bold text-gray-900 hover:text-primary line-clamp-2">{it.name}</Link>
                <p className="text-xs text-gray-500 mt-0.5">
                  {[sizeLabel(it.size), it.color].filter(Boolean).join(" / ") || "—"}
                </p>
                <p className="text-base font-bold text-primary mt-1">{money(it.price)}</p>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center border border-gray-300 rounded-full">
                    <button onClick={() => updateQty(it.variantId, it.qty - 1)} className="p-2 text-gray-600 hover:text-primary"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="w-8 text-center text-sm font-bold">{it.qty}</span>
                    <button onClick={() => updateQty(it.variantId, it.qty + 1)} className="p-2 text-gray-600 hover:text-primary"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                  <button onClick={() => removeItem(it.variantId)} className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="text-right font-extrabold text-lg text-gray-900 hidden sm:block">{money(it.price * it.qty)}</div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-24 h-max bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Order summary</h2>

          {freeDeliveryProgress !== null && !freeDelivery && (
            <div className="mb-4">
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${freeDeliveryProgress}%` }} />
              </div>
              <p className="text-xs text-primary font-medium mt-1.5">
                Add {money((config?.freeDeliveryOver ?? 0) - subtotal)} more for free delivery.
              </p>
            </div>
          )}

          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-medium">{money(subtotal)}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Delivery</span>
              {freeDelivery ? (
                <span className="font-semibold text-green-600">Free</span>
              ) : (
                <span className="text-xs text-gray-400">Calculated at checkout</span>
              )}
            </div>
          </div>

          <div className="flex justify-between items-baseline mt-3 pt-3 border-t border-gray-200">
            <span className="text-base font-bold text-gray-900">Total</span>
            <span className="text-2xl font-extrabold text-primary">{money(subtotal)}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Delivery is calculated by your province at checkout.</p>

          <Link href="/checkout" className="mt-5 w-full bg-primary text-white py-3.5 rounded-lg font-bold text-base flex items-center justify-center gap-2 shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-[0.99] transition-all">
            Checkout <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/shop" className="mt-3 block text-center text-sm text-gray-500 hover:text-primary">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}
