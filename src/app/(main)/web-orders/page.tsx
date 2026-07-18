"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { getWebOrders, verifyWebPayment, setWebOrderStatus, setWebDeliveryStatus, getWebOrderDetails } from "./actions";
import {
  Globe, Truck, Landmark, CheckCircle2, ExternalLink, Phone, MapPin, ShieldCheck, RefreshCw, Package, ChevronDown,
  Search as SearchIcon,
} from "lucide-react";
import Pager from "@/components/ui/Pager";

const money = (n: number) => "Rs. " + Number(n || 0).toLocaleString();

const STATUSES = ["Pending", "Paid", "Partial", "Completed", "Canceled"] as const;
const statusColor: Record<string, string> = {
  Pending: "bg-amber-500/20 text-amber-400",
  Paid: "bg-green-500/20 text-green-400",
  Completed: "bg-green-500/20 text-green-400",
  Partial: "bg-blue-500/20 text-blue-400",
  Canceled: "bg-red-500/20 text-red-400",
};

const DELIVERY_STATUSES = ["Processing", "Ready", "Handed to courier", "Delivered", "Returned"] as const;
const deliveryColor: Record<string, string> = {
  Processing: "bg-gray-500/20 text-gray-400",
  Ready: "bg-amber-500/20 text-amber-400",
  "Handed to courier": "bg-blue-500/20 text-blue-400",
  Delivered: "bg-green-500/20 text-green-400",
  Returned: "bg-red-500/20 text-red-400",
};

const PAGE_SIZE = 50;

export default function WebOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [unverifiedTotal, setUnverifiedTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "unverified">("all");
  const [slip, setSlip] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, any[]>>({});
  const [openItems, setOpenItems] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [debounced, filter]);

  async function toggleItems(id: string) {
    if (openItems === id) { setOpenItems(null); return; }
    setOpenItems(id);
    if (!items[id]) {
      try {
        const d = await getWebOrderDetails(id);
        setItems((prev) => ({ ...prev, [id]: d.items || [] }));
      } catch (e: any) {
        toast.error(e.message || "Failed to load items");
      }
    }
  }

  async function load(quiet = false) {
    if (!quiet) setLoading(true);
    try {
      const d = await getWebOrders({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        search: debounced,
        unverifiedOnly: filter === "unverified",
      });
      if (!d.ok) throw new Error(d.error);
      setOrders(d.rows);
      setTotal(d.total);
      setUnverifiedTotal(d.unverifiedTotal);
    } catch (e: any) {
      if (!quiet) toast.error(e.message || "Failed to load");
    } finally {
      if (!quiet) setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // Keep the list fresh — new website orders should appear without a manual
    // refresh (same 30s cadence as the manual /orders page). The quiet reload
    // keeps the CURRENT page/search/tab.
    const interval = setInterval(() => load(true), 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debounced, filter]);

  async function verify(id: string) {
    if (!confirm("Mark this bank-transfer payment as verified and set the order to Paid?")) return;
    try {
      const res = await verifyWebPayment(id);
      if (!res.ok) throw new Error(res.error);
      toast.success("Payment verified — order marked Paid");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  }

  async function changeStatus(id: string, status: any) {
    try {
      const res = await setWebOrderStatus(id, status);
      if (!res.ok) throw new Error(res.error);
      toast.success("Status updated");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  }

  async function changeDelivery(id: string, status: any) {
    try {
      const res = await setWebDeliveryStatus(id, status);
      if (!res.ok) throw new Error(res.error);
      toast.success("Delivery status updated");
      load(true);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  }

  const shown = orders; // server-side filtered + paged

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-3 rounded-lg"><Globe className="w-6 h-6 text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold">Website Orders</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Orders placed by customers on the storefront</p>
          </div>
        </div>
        <button onClick={() => load()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-medium">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => setFilter("all")} className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === "all" ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}>All ({total})</button>
        <button onClick={() => setFilter("unverified")} className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === "unverified" ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}>
          Needs verification ({unverifiedTotal})
        </button>
        <div className="relative ml-auto">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, phone or order #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-72"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" /></div>
      ) : shown.length === 0 ? (
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-center py-12 text-gray-500 dark:text-gray-400">
          <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
          No website orders yet.
        </div>
      ) : (
        <>
        <div className="grid gap-3">
          {shown.map((o) => (
            <div key={o.Id} className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold">#{String(o.Id).slice(0, 8).toUpperCase()}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[o.PaymentStatus] || "bg-gray-200 text-gray-600"}`}>{o.PaymentStatus}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${deliveryColor[o.DeliveryStatus] || "bg-gray-500/20 text-gray-400"}`}>{o.DeliveryStatus || "Processing"}</span>
                    {o.PaymentMethod === "BankTransfer" ? (
                      <span className="text-xs flex items-center gap-1 text-gray-500"><Landmark className="w-3 h-3" /> Bank{o.PaymentVerified ? <ShieldCheck className="w-3 h-3 text-green-500" /> : ""}</span>
                    ) : (
                      <span className="text-xs flex items-center gap-1 text-gray-500"><Truck className="w-3 h-3" /> COD</span>
                    )}
                    {o.HasPrintOnDemand && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Print on demand</span>
                    )}
                  </div>
                  <p className="text-sm font-medium">{o.Customer}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {o.CustomerPhone}{o.SecondaryPhone ? ` / ${o.SecondaryPhone}` : ""}</p>
                  <p className="text-xs text-gray-500 flex items-start gap-1 mt-0.5"><MapPin className="w-3 h-3 mt-0.5 shrink-0" /> {o.Address}{o.Province ? `, ${o.Province}` : ""}</p>
                  {o.Notes && <p className="text-xs text-gray-400 mt-1 italic">“{o.Notes}”</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(o.OrderDate).toLocaleString()} · {o.LineCount} item(s)</p>
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold">{money(o.Total)}</p>
                  <p className="text-xs text-gray-400">{money(o.Subtotal)} + {o.DeliveryFee === 0 ? "free del." : money(o.DeliveryFee)}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button onClick={() => toggleItems(o.Id)} className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 font-medium">
                  <Package className="w-3 h-3" /> {openItems === o.Id ? "Hide items" : `View items (${o.LineCount})`}
                  <ChevronDown className={`w-3 h-3 transition-transform ${openItems === o.Id ? "rotate-180" : ""}`} />
                </button>
                {o.PaymentSlipUrl && (
                  <button onClick={() => setSlip(o.PaymentSlipUrl)} className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 font-medium">
                    <ExternalLink className="w-3 h-3" /> View slip
                  </button>
                )}
                {o.PaymentMethod === "BankTransfer" && !o.PaymentVerified && o.PaymentStatus !== "Paid" && o.PaymentStatus !== "Completed" && (
                  <button onClick={() => verify(o.Id)} className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-500 font-medium hover:bg-green-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verify payment → Paid
                  </button>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="hidden sm:inline">Payment</span>
                    <select
                      value={o.PaymentStatus}
                      onChange={(e) => changeStatus(o.Id, e.target.value)}
                      className="text-xs bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="hidden sm:inline">Delivery</span>
                    <select
                      value={o.DeliveryStatus || "Processing"}
                      onChange={(e) => changeDelivery(o.Id, e.target.value)}
                      className="text-xs bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5"
                    >
                      {DELIVERY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              {openItems === o.Id && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  {!items[o.Id] ? (
                    <p className="text-xs text-gray-400">Loading items…</p>
                  ) : items[o.Id].length === 0 ? (
                    <p className="text-xs text-gray-400">No items.</p>
                  ) : (
                    <div className="space-y-2">
                      {items[o.Id].map((it: any) => (
                        <div key={it.Id} className="flex items-center justify-between text-sm gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {it.LineImage && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={it.LineImage} alt="" className="w-9 h-9 rounded object-cover shrink-0 border border-gray-200 dark:border-gray-700" />
                            )}
                            <div className="min-w-0">
                              <span className="font-medium">{it.ProductName}</span>
                              <span className="text-gray-500"> · {[it.SizeName, it.ColorName].filter(Boolean).join(" / ") || "—"}</span>
                            </div>
                          </div>
                          <span className="text-gray-600 dark:text-gray-300 shrink-0">{it.Qty} × {money(it.SellingPrice)} = <b>{money(it.Qty * it.SellingPrice)}</b></span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <Pager
            page={page}
            pageSize={PAGE_SIZE}
            total={filter === "unverified" ? unverifiedTotal : total}
            onPage={setPage}
          />
        </div>
        </>
      )}

      {/* Slip viewer */}
      {slip && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSlip(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slip} alt="Payment slip" className="max-h-[90vh] max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
