"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { getDispatchMessages, deleteDispatchMessage } from "./actions";

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

type DispatchMsg = {
  Id: string;
  OrderId: string;
  WaybillId: string;
  CustomerName: string | null;
  CustomerPhone: string | null;
  CreatedAt: string;
};

export default function DispatchPage() {
  const [messages, setMessages] = useState<DispatchMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getDispatchMessages();
      setMessages(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCopy(msg: DispatchMsg) {
    try {
      await navigator.clipboard.writeText(buildMessage(msg.WaybillId));
      setCopiedId(msg.Id);
      toast.success("Message copied!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  function handleWhatsApp(msg: DispatchMsg) {
    if (!msg.CustomerPhone) return;
    const text = buildMessage(msg.WaybillId);
    const clean = msg.CustomerPhone.replace(/\D/g, "");
    const number = clean.startsWith("0") ? "94" + clean.slice(1) : clean;
    window.open(
      `https://wa.me/${number}?text=${encodeURIComponent(text)}`,
      "_blank"
    );
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

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Dispatch Messages
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Courier handover messages · Auto-deleted after 7 days
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium transition disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Count badge */}
      {!loading && messages.length > 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {messages.length} message{messages.length !== 1 ? "s" : ""} in the last 7 days
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <p>Loading messages…</p>
        </div>
      ) : messages.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-gray-400 dark:text-gray-500"
        >
          <Package className="h-14 w-14 mb-4 opacity-25" />
          <p className="text-lg font-medium">No dispatch messages yet</p>
          <p className="text-sm mt-1 text-center max-w-xs">
            Messages are created automatically when you add a Waybill ID to an
            order.
          </p>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.Id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-4 p-5 pb-3">
                  <div className="space-y-1.5">
                    <p className="font-semibold text-gray-900 dark:text-white text-base">
                      {msg.CustomerName || "Unknown Customer"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {msg.CustomerPhone && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {msg.CustomerPhone}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full font-mono border border-blue-200 dark:border-blue-800">
                        Waybill: {msg.WaybillId}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        {timeAgo(msg.CreatedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {msg.CustomerPhone && (
                      <button
                        onClick={() => handleWhatsApp(msg)}
                        title="Open in WhatsApp"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-medium transition shadow-sm"
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(msg)}
                      title="Copy message"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium transition"
                    >
                      {copiedId === msg.Id ? (
                        <>
                          <CheckCheck className="h-4 w-4 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(msg.Id)}
                      disabled={deletingId === msg.Id}
                      title="Delete"
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Message preview */}
                <div className="mx-5 mb-5 bg-gray-50 dark:bg-gray-900/60 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                  {buildMessage(msg.WaybillId)}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
