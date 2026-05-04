"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, X, Package, Clock, RotateCcw, AlertTriangle, RefreshCw } from "lucide-react";
import { getNotifications, type NotificationItem } from "@/lib/getNotifications";

const DISMISSED_KEY = "ef_dismissed_notifications";

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

const TYPE_ICON: Record<NotificationItem["type"], React.ReactNode> = {
  out_of_stock: <Package className="h-4 w-4" />,
  low_stock:    <AlertTriangle className="h-4 w-4" />,
  stale_pending:<Clock className="h-4 w-4" />,
  recent_return:<RotateCcw className="h-4 w-4" />,
};

const SEVERITY_STYLES: Record<NotificationItem["severity"], string> = {
  critical: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",
  warning:  "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
  info:     "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
};

const BADGE_STYLES: Record<NotificationItem["severity"], string> = {
  critical: "bg-red-500",
  warning:  "bg-amber-500",
  info:     "bg-blue-500",
};

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<NotificationItem[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getNotifications();
      setAll(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setDismissed(getDismissed());
    load();
    const interval = setInterval(load, 60_000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const visible = all.filter((n) => !dismissed.has(n.id));
  const criticalCount = visible.filter((n) => n.severity === "critical").length;
  const badgeCount = visible.length;

  function dismiss(id: string) {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    saveDismissed(next);
  }

  function dismissAll() {
    const next = new Set([...dismissed, ...all.map((n) => n.id)]);
    setDismissed(next);
    saveDismissed(next);
  }

  // Group by type label
  const groups: Record<string, NotificationItem[]> = {};
  const TYPE_LABEL: Record<NotificationItem["type"], string> = {
    out_of_stock:  "Out of Stock",
    low_stock:     "Low Stock",
    stale_pending: "Stale Pending Orders",
    recent_return: "Recent Returns",
  };
  for (const n of visible) {
    const label = TYPE_LABEL[n.type];
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        {badgeCount > 0 && (
          <span
            className={`absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full text-[10px] font-bold text-white ${
              criticalCount > 0 ? "bg-red-500" : "bg-amber-500"
            }`}
          >
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-10 w-80 max-h-[480px] flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-500" />
              <span className="font-semibold text-sm text-gray-800 dark:text-white">Notifications</span>
              {badgeCount > 0 && (
                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full">
                  {badgeCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={load}
                disabled={loading}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                title="Refresh"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
              {visible.length > 0 && (
                <button
                  onClick={dismissAll}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1">
            {loading && visible.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-gray-400">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
                <Bell className="h-8 w-8 mb-2 opacity-25" />
                <p className="text-sm">All caught up!</p>
              </div>
            ) : (
              <div className="p-3 space-y-4">
                {Object.entries(groups).map(([label, items]) => (
                  <div key={label}>
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">
                      {label}
                    </p>
                    <div className="space-y-1.5">
                      {items.map((n) => (
                        <div
                          key={n.id}
                          className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs ${SEVERITY_STYLES[n.severity]}`}
                        >
                          <span className="mt-0.5 shrink-0">{TYPE_ICON[n.type]}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold">{n.title}</p>
                            <p className="opacity-80 truncate">{n.body}</p>
                          </div>
                          <button
                            onClick={() => dismiss(n.id)}
                            className="shrink-0 opacity-50 hover:opacity-100 transition"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
