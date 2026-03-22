"use client";

import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Copy,
  CheckCheck,
  Trash2,
  MessageCircle,
  Clock,
  RefreshCw,
  ShoppingBag,
  Search,
  X,
} from "lucide-react";
import {
  getDispatchMessages,
  deleteDispatchMessage,
  syncPendingToDispatch,
} from "./actions";

function buildMessage(waybillId: string): string {
  return `📦✨ Good news!\nYour parcel has been handed over to our courier service 🚚💨\n\n🆔 Waybill ID: ${waybillId}\n📞 Kindly keep your phone available, as the courier may call to confirm delivery.\n\nThank you for shopping with EssenceFit 💙\n✨ Don't forget to confirm once you've received your order and share your feedback`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function matchesSearch(q: string, ...fields: (string | null | undefined)[]) {
  if (!q) return true;
  const lower = q.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(lower));
}

type DateFilter = "all" | "today" | "yesterday" | "last7";

function passesDateFilter(dateStr: string, filter: DateFilter): boolean {
  if (filter === "all") return true;
  const d = new Date(dateStr).getTime();
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (filter === "today") return d >= startOfToday.getTime();
  if (filter === "yesterday") return d >= startOfYesterday.getTime() && d < startOfToday.getTime();
  if (filter === "last7") return d >= now - 7 * 86400000;
  return true;
}

type DispatchMsg = {
  Id: string;
  OrderId: string;
  WaybillId: string;
  CustomerName: string | null;
  CustomerPhone: string | null;
  CreatedAt: string;
  OrderStatus: string;
};

const DATE_TABS: { label: string; value: DateFilter }[] = [
  { label: "All", value: "all" },
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 days", value: "last7" },
];

function MessageCard({
  msg,
  copiedId,
  deletingId,
  onCopy,
  onWhatsApp,
  onDelete,
}: {
  msg: DispatchMsg;
  copiedId: string | null;
  deletingId: string | null;
  onCopy: (id: string, text: string) => void;
  onWhatsApp: (phone: string, waybill: string) => void;
  onDelete: (id: string) => void;
}) {
  const hasWaybill = !!msg.WaybillId?.trim();
  const text = hasWaybill ? buildMessage(msg.WaybillId) : "";
  const isPending = msg.OrderStatus === "Pending";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`flex flex-col rounded-2xl border shadow-sm overflow-hidden bg-white dark:bg-gray-800 ${
        isPending
          ? "border-amber-200 dark:border-amber-800/40"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      {/* Card Header */}
      <div className="p-4 pb-2 flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
            {msg.CustomerName || "Unknown Customer"}
          </p>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
              isPending
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
            }`}
          >
            {msg.OrderStatus}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {msg.CustomerPhone && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{msg.CustomerPhone}</span>
          )}
          {hasWaybill ? (
            <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-mono border border-blue-200 dark:border-blue-800">
              {msg.WaybillId}
            </span>
          ) : (
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
              No Waybill
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            {timeAgo(msg.CreatedAt)}
          </span>
        </div>

        {/* Message preview */}
        {hasWaybill ? (
          <div className="bg-gray-50 dark:bg-gray-900/60 rounded-xl p-3 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line leading-relaxed max-h-32 overflow-hidden relative">
            {text}
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-gray-50 dark:from-gray-900/60 to-transparent rounded-b-xl" />
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-900/60 rounded-xl p-3 border border-dashed border-gray-200 dark:border-gray-700 text-xs text-gray-400 text-center">
            Add a Waybill ID to generate the message
          </div>
        )}
      </div>

      {/* Card Actions */}
      <div className="px-4 pb-4 pt-2 flex items-center gap-2">
        {msg.CustomerPhone && hasWaybill && (
          <button
            onClick={() => onWhatsApp(msg.CustomerPhone!, msg.WaybillId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-medium transition flex-1 justify-center"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </button>
        )}
        {hasWaybill && (
          <button
            onClick={() => onCopy(msg.Id, text)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-medium transition flex-1 justify-center"
          >
            {copiedId === msg.Id
              ? <><CheckCheck className="h-3.5 w-3.5 text-green-500" /> Copied!</>
              : <><Copy className="h-3.5 w-3.5" /> Copy</>}
          </button>
        )}
        <button
          onClick={() => onDelete(msg.Id)}
          disabled={deletingId === msg.Id}
          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

export default function DispatchPage() {
  const [messages, setMessages] = useState<DispatchMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingDateFilter, setPendingDateFilter] = useState<DateFilter>("all");
  const [savedDateFilter, setSavedDateFilter] = useState<DateFilter>("all");

  async function loadAll() {
    setLoading(true);
    try {
      await syncPendingToDispatch();
      const msgs = await getDispatchMessages();
      setMessages(msgs);
    } catch (e: any) {
      toast.error(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function handleCopy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Message copied!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  function handleWhatsApp(phone: string, waybillId: string) {
    const text = buildMessage(waybillId);
    const clean = phone.replace(/\D/g, "");
    const number = clean.startsWith("0") ? "94" + clean.slice(1) : clean;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteDispatchMessage(id);
      setMessages((prev) => prev.filter((m) => m.Id !== id));
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const pendingMessages = useMemo(() =>
    messages
      .filter((m) => m.OrderStatus === "Pending")
      .filter((m) => passesDateFilter(m.CreatedAt, pendingDateFilter))
      .filter((m) => matchesSearch(search, m.CustomerName, m.CustomerPhone, m.WaybillId)),
    [messages, search, pendingDateFilter]
  );

  const savedMessages = useMemo(() =>
    messages
      .filter((m) => m.OrderStatus !== "Pending")
      .filter((m) => passesDateFilter(m.CreatedAt, savedDateFilter))
      .filter((m) => matchesSearch(search, m.CustomerName, m.CustomerPhone, m.WaybillId)),
    [messages, search, savedDateFilter]
  );

  const cardProps = { copiedId, deletingId, onCopy: handleCopy, onWhatsApp: handleWhatsApp, onDelete: handleDelete };

  return (
    <div className="space-y-8">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dispatch Messages</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Courier handover messages · Auto-deleted after 7 days
            </p>
          </div>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium transition disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name, phone, or waybill ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <p>Loading…</p>
        </div>
      ) : (
        <>
          {/* ── Section 1: Pending Orders ── */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-amber-500" />
                <h2 className="font-semibold text-gray-800 dark:text-white">Pending Orders</h2>
                <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                  {pendingMessages.length}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                {DATE_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setPendingDateFilter(tab.value)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                      pendingDateFilter === tab.value
                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {pendingMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                <ShoppingBag className="h-10 w-10 mb-2 opacity-25" />
                <p className="text-sm">No pending orders with a Waybill ID</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence>
                  {pendingMessages.map((msg) => (
                    <MessageCard key={msg.Id} msg={msg} {...cardProps} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>

          {/* ── Section 2: Saved Messages ── */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-gray-800 dark:text-white">Saved Messages</h2>
                {savedMessages.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    {savedMessages.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                {DATE_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setSavedDateFilter(tab.value)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                      savedDateFilter === tab.value
                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {savedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                <Package className="h-10 w-10 mb-2 opacity-25" />
                <p className="text-sm">No saved messages found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence>
                  {savedMessages.map((msg) => (
                    <MessageCard key={msg.Id} msg={msg} {...cardProps} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
