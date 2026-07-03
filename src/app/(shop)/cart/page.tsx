"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/components/shop/CartContext";
import { money } from "@/components/shop/format";
import { getCheckoutConfig, type CheckoutConfig } from "../checkout/actions";

export default function CartPage() {
  const { items, updateQty, removeItem, subtotal, ready } = useCart();
  const [config, setConfig] = useState<CheckoutConfig | null>(null);

  useEffect(() => { getCheckoutConfig().then(setConfig).catch(() => {}); }, []);

  // Delivery depends on the province chosen at checkout, so the cart only shows
  // the subtotal — except when the order already qualifies for free delivery.
  const freeDelivery = !!config && config.freeDeliveryOver > 0 && subtotal >= config.freeDeliveryOver;

  if (ready && items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
        <p className="text-gray-500 mb-6">Looks like you haven&apos;t added anything yet.</p>
        <Link href="/shop" className="inline-block bg-primary text-white px-8 py-3 rounded-full font-semibold hover:bg-primary/90">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Shopping cart</h1>

      <div className="grid lg:grid-cols-[1fr_340px] gap-8">
        {/* Items */}
        <div className="space-y-4">
          {items.map((it) => (
            <div key={it.variantId} className="flex gap-4 bg-white border border-gray-200 rounded-lg p-3">
              <Link href={`/product/${it.slug}`} className="shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-gray-100">
                  {it.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                  ) : null}
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/product/${it.slug}`} className="font-medium text-gray-900 hover:text-primary line-clamp-2">{it.name}</Link>
                <p className="text-xs text-gray-500 mt-0.5">
                  {[it.size, it.color].filter(Boolean).join(" / ") || "—"}
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{money(it.price)}</p>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center border border-gray-300 rounded-full">
                    <button onClick={() => updateQty(it.variantId, it.qty - 1)} className="p-2 text-gray-600 hover:text-primary"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="w-8 text-center text-sm font-medium">{it.qty}</span>
                    <button onClick={() => updateQty(it.variantId, it.qty + 1)} className="p-2 text-gray-600 hover:text-primary"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                  <button onClick={() => removeItem(it.variantId)} className="text-gray-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="text-right font-semibold text-gray-900 hidden sm:block">{money(it.price * it.qty)}</div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-24 h-max bg-gray-50 border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Order summary</h2>
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
            {!freeDelivery && config && config.freeDeliveryOver > 0 && subtotal < config.freeDeliveryOver && (
              <p className="text-xs text-primary">
                Add {money(config.freeDeliveryOver - subtotal)} more for free delivery.
              </p>
            )}
            <div className="border-t border-gray-200 pt-2 flex justify-between text-base">
              <span className="font-semibold">Total</span><span className="font-bold">{money(subtotal)}</span>
            </div>
            <p className="text-xs text-gray-400 pt-1">Delivery is calculated by your province at checkout.</p>
          </div>
          <Link href="/checkout" className="mt-5 w-full bg-primary text-white py-3 rounded-full font-semibold flex items-center justify-center gap-2 hover:bg-primary/90">
            Checkout <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/shop" className="mt-2 block text-center text-sm text-gray-500 hover:text-primary">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}
