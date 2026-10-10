"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Printer, X, Plus, Check, Trash2, Search, Package, Loader2 } from "lucide-react";
import Pager from "@/components/ui/Pager";
import {
  getPrintJobs,
  createPrintJob,
  setPrintJobStatus,
  deletePrintJob,
} from "./actions";

const money = (n: number | null | undefined) => "Rs. " + Number(n || 0).toLocaleString();

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  HandedOver: "bg-green-100 text-green-700",
};

type Row = {
  Id: string;
  Ref: string;
  Giver: string | null;
  Garment: string | null;
  Qty: number;
  DtfCostPerUnit: number;
  ProfitPerUnit: number;
  ChargePerUnit: number;
  TotalCost: number;
  TotalCharge: number;
  TotalProfit: number;
  Status: string;
  HandedOverAt: string | null;
  Note: string | null;
  CreatedAt: string;
};

type Totals = { TotalQty: number; TotalCharge: number; TotalCost: number; TotalProfit: number };

const PAGE_SIZE = 50;
const STATUS_OPTIONS = ["", "Pending", "HandedOver"];

export default function PrintJobsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const d = await getPrintJobs({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        status,
        search: debouncedSearch,
      });
      setRows(d.rows as Row[]);
      setTotal(d.total);
      setTotals(d.totals as Totals);
    } catch {
      toast.error("Failed to load print jobs");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, debouncedSearch]);
  useEffect(() => { setPage(1); }, [status, debouncedSearch]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function markHandedOver(id: string) {
    const res = await setPrintJobStatus(id, "HandedOver");
    if (!res.ok) return toast.error(res.error);
    toast.success("Marked handed over");
    load();
  }

  async function remove(id: string, ref: string) {
    if (!confirm(`Delete ${ref}? This also removes its recorded sale/profit.`)) return;
    const res = await deletePrintJob(id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Deleted");
    load();
  }

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      <div className="flex items-center gap-3 mb-6">
        <div className="bg-primary/20 p-3 rounded-lg">
          <Printer className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Print Jobs</h1>
          <p className="text-sm text-gray-500">
            Printing on garments supplied by others — you pay DTF, keep profit, hand them back. No stock movement.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search giver, garment, ref…"
              className="w-56 pl-9 pr-3 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm"
              aria-label="Search print jobs"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm"
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s || "all"} value={s}>{s || "All statuses"}</option>
            ))}
          </select>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-white font-medium text-sm"
          >
            <Plus className="w-4 h-4" /> New job
          </button>
        </div>
      </div>

      {/* Summary strip (across the current filter) */}
      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Stat label="Garments" value={String(totals.TotalQty)} />
          <Stat label="Total charge" value={money(totals.TotalCharge)} />
          <Stat label="DTF cost" value={money(totals.TotalCost)} />
          <Stat label="Your profit" value={money(totals.TotalProfit)} accent />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{debouncedSearch || status ? "No print jobs match your search." : "No print jobs yet — add one with “New job”."}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700/50">
                <tr>
                  <th className="p-3 text-left font-semibold">Ref</th>
                  <th className="p-3 text-left font-semibold">Giver</th>
                  <th className="p-3 text-left font-semibold">Garment</th>
                  <th className="p-3 text-right font-semibold">Qty</th>
                  <th className="p-3 text-right font-semibold">DTF/ea</th>
                  <th className="p-3 text-right font-semibold">Profit/ea</th>
                  <th className="p-3 text-right font-semibold">Charge</th>
                  <th className="p-3 text-right font-semibold">Profit</th>
                  <th className="p-3 text-center font-semibold">Status</th>
                  <th className="p-3 text-left font-semibold">Date</th>
                  <th className="p-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.Id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="p-3 font-medium">{o.Ref}</td>
                    <td className="p-3">{o.Giver || "-"}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-300">{o.Garment || "-"}</td>
                    <td className="p-3 text-right">{o.Qty}</td>
                    <td className="p-3 text-right">{money(o.DtfCostPerUnit)}</td>
                    <td className="p-3 text-right">{money(o.ProfitPerUnit)}</td>
                    <td className="p-3 text-right">{money(o.TotalCharge)}</td>
                    <td className="p-3 text-right font-semibold text-green-600 dark:text-green-400">{money(o.TotalProfit)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[o.Status] || "bg-gray-100 text-gray-600"}`}>
                        {o.Status}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500">{new Date(o.CreatedAt).toLocaleDateString()}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {o.Status !== "HandedOver" && (
                          <button
                            onClick={() => markHandedOver(o.Id)}
                            title="Mark handed over"
                            className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => remove(o.Id, o.Ref)}
                          title="Delete"
                          className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); setPage(1); load(); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${accent ? "text-green-600 dark:text-green-400" : ""}`}>{value}</p>
    </div>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [giver, setGiver] = useState("");
  const [garment, setGarment] = useState("");
  const [qty, setQty] = useState("");
  const [dtf, setDtf] = useState("");
  const [profit, setProfit] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const q = Number(qty) || 0;
  const d = Number(dtf) || 0;
  const p = Number(profit) || 0;
  const chargePerUnit = d + p;
  const totalCharge = chargePerUnit * q;
  const totalCost = d * q;
  const totalProfit = p * q;

  async function submit() {
    setBusy(true);
    try {
      const res = await createPrintJob({
        giver,
        garment,
        qty: q,
        dtfCostPerUnit: d,
        profitPerUnit: p,
        note: note || null,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success(`Created ${res.ref}`);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" /> New print job
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Giver (father / supplier)">
              <input value={giver} onChange={(e) => setGiver(e.target.value)} placeholder="e.g. Father"
                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5" />
            </Field>
            <Field label="Garment *">
              <input value={garment} onChange={(e) => setGarment(e.target.value)} placeholder="e.g. T-shirts"
                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Quantity *">
              <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="50"
                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5" />
            </Field>
            <Field label="DTF cost / garment">
              <input type="number" min={0} value={dtf} onChange={(e) => setDtf(e.target.value)} placeholder="300"
                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5" />
            </Field>
            <Field label="Profit / garment">
              <input type="number" min={0} value={profit} onChange={(e) => setProfit(e.target.value)} placeholder="200"
                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5" />
            </Field>
          </div>

          <Field label="Note">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 resize-none" />
          </Field>

          {/* Live totals */}
          <div className="text-sm bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 space-y-1">
            <div className="flex justify-between"><span>Charge / garment</span><span>{money(chargePerUnit)}</span></div>
            <div className="flex justify-between"><span>Total charge ({q || 0})</span><span>{money(totalCharge)}</span></div>
            <div className="flex justify-between text-gray-500"><span>DTF cost (you pay)</span><span>{money(totalCost)}</span></div>
            <div className="flex justify-between font-bold text-green-600 dark:text-green-400 border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
              <span>Your profit</span><span>{money(totalProfit)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-5 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} disabled={busy}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 font-medium disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={busy}
            className="ml-auto px-4 py-2 rounded-lg bg-primary text-white font-medium flex items-center gap-1.5 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Create job
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
    </div>
  );
}
