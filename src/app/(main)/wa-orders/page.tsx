"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { MessageCircle, Check, X, RefreshCw, Package } from "lucide-react";
import { listWaPending, placeWaPending, rejectWaPending } from "./actions";
import type { PendingOrder } from "@/lib/waPendingOrders";

export default function WaOrdersPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setOrders(await listWaPending());
    } catch {
      toast.error("Failed to load pending orders");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function place(id: string) {
    setBusy(id);
    try {
      const r = await placeWaPending(id);
      if (r.ok) {
        toast.success("Order created ✅");
        setOrders((o) => o.filter((x) => x.id !== id));
      } else {
        toast.error(r.error, { duration: 6000 });
      }
    } catch {
      toast.error("Failed to place order");
    } finally {
      setBusy(null);
    }
  }

  async function reject(id: string) {
    if (!window.confirm("Reject this order?")) return;
    setBusy(id);
    try {
      await rejectWaPending(id);
      setOrders((o) => o.filter((x) => x.id !== id));
      toast.success("Rejected");
    } catch {
      toast.error("Failed");
    } finally {
      setBusy(null);
    }
  }

  const money = (n: number) => `Rs. ${Number(n).toLocaleString("en-LK")}`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg">
            <MessageCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">WhatsApp Orders</h1>
            <p className="text-sm text-gray-500">
              Orders collected by the bot — review and place them
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No pending WhatsApp orders right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {orders.map((o) => (
            <div
              key={o.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">
                    {o.customerName || "(no name)"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {o.phone} · {new Date(o.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {money(o.total)}
                </span>
              </div>

              {o.address && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                  📍 {o.address}
                </p>
              )}

              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-3 text-sm">
                {o.items.map((it, i) => (
                  <div key={i} className="flex justify-between py-0.5">
                    <span>
                      {it.qty} × {it.product} — {it.size} / {it.colour}
                      {it.inStock !== null && it.inStock < it.qty && (
                        <span className="text-red-500 font-medium"> (only {it.inStock} in stock!)</span>
                      )}
                      {it.variantId === null && (
                        <span className="text-amber-500 font-medium"> (no match — check colour/size)</span>
                      )}
                    </span>
                    <span className="text-gray-500">{money(it.price * it.qty)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2 text-gray-500 space-y-0.5">
                  <div className="flex justify-between"><span>Subtotal</span><span>{money(o.subtotal)}</span></div>
                  <div className="flex justify-between">
                    <span>Delivery</span>
                    <span>{o.deliveryFee > 0 ? money(o.deliveryFee) : "FREE (3+ items)"}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-gray-900 dark:text-white">
                    <span>Total</span><span>{money(o.total)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => place(o.id)}
                  disabled={busy === o.id}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition text-sm"
                >
                  <Check className="w-4 h-4" />
                  {busy === o.id ? "Placing…" : "Create order"}
                </button>
                <button
                  onClick={() => reject(o.id)}
                  disabled={busy === o.id}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition"
                  title="Reject"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
