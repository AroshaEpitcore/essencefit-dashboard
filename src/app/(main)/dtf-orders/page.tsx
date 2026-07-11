"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Shirt, X, FileText, MessageCircle, Check, Loader2, Package } from "lucide-react";
import Pager from "@/components/ui/Pager";
import {
  getDtfOrders,
  getDtfOrderDetails,
  updateDtfOrderPricing,
  confirmDtfOrder,
  setDtfOrderStatus,
  type DtfOrderStatus,
} from "./actions";

const money = (n: number | null | undefined) => "Rs. " + Number(n || 0).toLocaleString();

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Confirmed: "bg-blue-100 text-blue-700",
  InProduction: "bg-purple-100 text-purple-700",
  Ready: "bg-teal-100 text-teal-700",
  Completed: "bg-green-100 text-green-700",
  Canceled: "bg-gray-200 text-gray-500",
};

const NEXT_STATUSES: DtfOrderStatus[] = ["InProduction", "Ready", "Completed"];

type Row = {
  Id: string;
  Ref: string;
  CustomerName: string;
  CustomerPhone: string;
  WhatsApp: string | null;
  Qty: number;
  EstimatedTotal: number;
  FinalTotal: number | null;
  Status: string;
  StockDeducted: boolean;
  CreatedAt: string;
  ProductName: string | null;
  DesignCount: number;
};

const PAGE_SIZE = 50;
const STATUS_OPTIONS = ["", "Pending", "Confirmed", "InProduction", "Ready", "Completed", "Canceled"];

export default function DtfOrdersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const d = await getDtfOrders({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, status });
      setRows(d.rows as Row[]);
      setTotal(d.total);
    } catch {
      toast.error("Failed to load DTF orders");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);
  useEffect(() => { setPage(1); }, [status]);

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      <div className="flex items-center gap-3 mb-6">
        <div className="bg-primary/20 p-3 rounded-lg">
          <Shirt className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">DTF Orders</h1>
          <p className="text-sm text-gray-500">Customer customization requests — confirm to reserve stock</p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="ml-auto p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s || "all"} value={s}>{s || "All statuses"}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No DTF orders yet.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700/50">
                <tr>
                  <th className="p-3 text-left font-semibold">Ref</th>
                  <th className="p-3 text-left font-semibold">Customer</th>
                  <th className="p-3 text-left font-semibold">Garment</th>
                  <th className="p-3 text-right font-semibold">Qty</th>
                  <th className="p-3 text-right font-semibold">Estimate</th>
                  <th className="p-3 text-right font-semibold">Final</th>
                  <th className="p-3 text-center font-semibold">Designs</th>
                  <th className="p-3 text-center font-semibold">Status</th>
                  <th className="p-3 text-left font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr
                    key={o.Id}
                    onClick={() => setOpenId(o.Id)}
                    className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                  >
                    <td className="p-3 font-medium">{o.Ref}</td>
                    <td className="p-3">
                      {o.CustomerName}
                      <span className="block text-xs text-gray-500">{o.CustomerPhone}</span>
                    </td>
                    <td className="p-3 text-gray-600 dark:text-gray-300">{o.ProductName || "-"}</td>
                    <td className="p-3 text-right">{o.Qty}</td>
                    <td className="p-3 text-right">{money(o.EstimatedTotal)}</td>
                    <td className="p-3 text-right font-semibold">{o.FinalTotal != null ? money(o.FinalTotal) : "-"}</td>
                    <td className="p-3 text-center">{o.DesignCount}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[o.Status] || "bg-gray-100 text-gray-600"}`}>
                        {o.Status}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500">{new Date(o.CreatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </div>
      )}

      {openId && (
        <DetailModal id={openId} onClose={() => setOpenId(null)} onChanged={load} />
      )}
    </div>
  );
}

function DetailModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [designs, setDesigns] = useState<any[]>([]);
  const [finalTotal, setFinalTotal] = useState("");
  const [advance, setAdvance] = useState("");
  const [adminNote, setAdminNote] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { order, designs } = await getDtfOrderDetails(id);
      setOrder(order);
      setDesigns(designs);
      setFinalTotal(order.FinalTotal != null ? String(order.FinalTotal) : "");
      setAdvance(order.AdvanceAmount != null ? String(order.AdvanceAmount) : "");
      setAdminNote(order.AdminNote || "");
    } catch {
      toast.error("Failed to load order");
      onClose();
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function savePricing() {
    setBusy(true);
    try {
      const res = await updateDtfOrderPricing(
        id,
        finalTotal.trim() === "" ? null : Number(finalTotal),
        advance.trim() === "" ? null : Number(advance),
        adminNote || null
      );
      if (!res.ok) throw new Error(res.error);
      toast.success("Saved");
      await load();
      onChanged();
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const res = await confirmDtfOrder(id);
      if (!res.ok) throw new Error(res.error);
      toast.success("Confirmed — stock reserved");
      await load();
      onChanged();
    } catch (err: any) {
      toast.error(err.message || "Confirm failed");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: DtfOrderStatus) {
    setBusy(true);
    try {
      const res = await setDtfOrderStatus(id, status);
      if (!res.ok) throw new Error(res.error);
      toast.success(`Status: ${status}`);
      await load();
      onChanged();
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const breakdown = (() => {
    try { return order?.BreakdownJson ? JSON.parse(order.BreakdownJson) : null; } catch { return null; }
  })();
  const wa = (order?.WhatsApp || order?.CustomerPhone || "").replace(/[^\d]/g, "");

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Shirt className="w-5 h-5 text-primary" /> {order?.Ref || "DTF Order"}
            {order && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[order.Status] || ""}`}>{order.Status}</span>
            )}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {loading || !order ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" /></div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Customer */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Customer</p>
                <p className="font-medium">{order.CustomerName}</p>
                <p>{order.CustomerPhone}</p>
                {order.Email && <p className="text-gray-500">{order.Email}</p>}
                {order.Address && <p className="text-gray-500">{order.Address}</p>}
              </div>
              <div>
                <p className="text-gray-500">Garment</p>
                <p className="font-medium">{order.ProductName}</p>
                <p>{[order.SizeName, order.ColorName].filter(Boolean).join(" / ") || "No variant chosen"}</p>
                <p>Qty: {order.Qty}{order.VariantStock != null ? ` · variant stock: ${order.VariantStock}` : ""}</p>
                {order.PrintOptions && <p className="text-gray-500">Prints: {order.PrintOptions}</p>}
              </div>
            </div>

            {wa && (
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 text-sm text-green-700 font-medium">
                <MessageCircle className="w-4 h-4" /> WhatsApp the customer
              </a>
            )}

            {order.CustomerNote && (
              <div className="text-sm">
                <p className="text-gray-500 mb-1">Customer note</p>
                <p className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 whitespace-pre-wrap">{order.CustomerNote}</p>
              </div>
            )}

            {/* Designs */}
            <div>
              <p className="text-gray-500 text-sm mb-2">Designs ({designs.length})</p>
              <div className="flex flex-wrap gap-3">
                {designs.map((d) => (
                  <a key={d.Id} href={d.Url} target="_blank" rel="noopener noreferrer"
                     className="w-24 h-24 rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden bg-gray-50 flex items-center justify-center">
                    {d.Kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.Url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center text-gray-500"><FileText className="w-7 h-7" /><span className="text-[10px] mt-1">PDF</span></div>
                    )}
                  </a>
                ))}
              </div>
            </div>

            {/* Estimate breakdown */}
            <div className="text-sm bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
              <div className="flex justify-between"><span>Garment</span><span>{money(order.GarmentPrice)}</span></div>
              {breakdown?.prints?.map((p: any, i: number) => (
                <div key={i} className="flex justify-between"><span>Print — {p.name}</span><span>+{money(p.amount)}</span></div>
              ))}
              <div className="flex justify-between"><span>Overheads + profit</span><span>+{money((breakdown?.overheadTotal || 0) + (breakdown?.profit || 0))}</span></div>
              {breakdown?.orderExtra > 0 && <div className="flex justify-between"><span>Order extra</span><span>+{money(breakdown.orderExtra)}</span></div>}
              <div className="flex justify-between font-bold text-primary border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                <span>Estimated total</span><span>{money(order.EstimatedTotal)}</span>
              </div>
            </div>

            {/* Admin pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Final total (Rs)</label>
                <input type="number" value={finalTotal} onChange={(e) => setFinalTotal(e.target.value)}
                  placeholder={String(order.EstimatedTotal)} className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Advance (Rs)</label>
                <input type="number" value={advance} onChange={(e) => setAdvance(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Admin note</label>
              <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={2}
                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 resize-none" />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
              <button onClick={savePricing} disabled={busy}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 font-medium disabled:opacity-50">
                Save pricing
              </button>
              {order.Status === "Pending" && (
                <button onClick={confirm} disabled={busy}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-1.5 disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirm &amp; reserve stock
                </button>
              )}
              {order.Status !== "Pending" && order.Status !== "Canceled" &&
                NEXT_STATUSES.map((s) => (
                  <button key={s} onClick={() => changeStatus(s)} disabled={busy || order.Status === s}
                    className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 font-medium text-sm disabled:opacity-40">
                    {s}
                  </button>
                ))}
              {order.Status !== "Canceled" && (
                <button onClick={() => changeStatus("Canceled")} disabled={busy}
                  className="ml-auto px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium disabled:opacity-50">
                  Cancel order
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
