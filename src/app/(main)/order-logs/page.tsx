"use client";

import { useEffect, useState, useMemo } from "react";
import toast, { Toaster } from "react-hot-toast";
import { History, Search, Calendar, ArrowRight, X } from "lucide-react";
import { getOrderLogs, getOrderLogStats, type OrderLog } from "./actions";

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  Paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  Partial: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Canceled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function OrderLogsPage() {
  const [logs, setLogs] = useState<OrderLog[]>([]);
  const [stats, setStats] = useState<{ NewStatus: string; Count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchOrderId, setSearchOrderId] = useState("");

  // Pagination
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  async function loadLogs() {
    setLoading(true);
    try {
      const [logsResult, statsResult] = await Promise.all([
        getOrderLogs({
          limit: pageSize,
          offset: page * pageSize,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          status: statusFilter || undefined,
          orderId: searchOrderId || undefined,
        }),
        getOrderLogStats(fromDate || undefined, toDate || undefined),
      ]);
      setLogs(logsResult.logs);
      setTotal(logsResult.total);
      setStats(statsResult);
    } catch (e: any) {
      toast.error(e.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [page]);

  function applyFilters() {
    setPage(0);
    loadLogs();
  }

  function clearFilters() {
    setFromDate("");
    setToDate("");
    setStatusFilter("");
    setSearchOrderId("");
    setPage(0);
    setTimeout(loadLogs, 0);
  }

  // Quick date helpers
  function setQuickDate(type: "today" | "yesterday" | "week" | "month") {
    const today = new Date();
    let from: Date;
    let to: Date = today;

    switch (type) {
      case "today":
        from = today;
        break;
      case "yesterday":
        from = new Date(today);
        from.setDate(from.getDate() - 1);
        to = from;
        break;
      case "week":
        from = new Date(today);
        from.setDate(today.getDate() - today.getDay());
        break;
      case "month":
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      default:
        from = today;
    }

    setFromDate(from.toISOString().slice(0, 10));
    setToDate(to.toISOString().slice(0, 10));
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      <div className="flex items-center gap-3 mb-6">
        <div className="bg-primary/20 p-3 rounded-lg">
          <History className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Order Status Logs</h1>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {stats.map((s) => (
          <div
            key={s.NewStatus}
            className={`p-4 rounded-xl ${STATUS_COLORS[s.NewStatus] || "bg-gray-100 dark:bg-gray-800"}`}
          >
            <div className="text-2xl font-bold">{s.Count}</div>
            <div className="text-sm opacity-80">→ {s.NewStatus}</div>
          </div>
        ))}
        {stats.length === 0 && !loading && (
          <div className="col-span-5 text-center text-gray-500 py-4">No data</div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 flex-wrap">
          {/* Quick date buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setQuickDate("today")}
              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Today
            </button>
            <button
              onClick={() => setQuickDate("yesterday")}
              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Yesterday
            </button>
            <button
              onClick={() => setQuickDate("week")}
              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              This Week
            </button>
            <button
              onClick={() => setQuickDate("month")}
              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              This Month
            </button>
          </div>

          <span className="hidden md:block text-gray-300 dark:text-gray-600">|</span>

          {/* Date inputs */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-sm"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-sm"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
            <option value="Completed">Completed</option>
            <option value="Canceled">Canceled</option>
          </select>

          {/* Order ID search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchOrderId}
              onChange={(e) => setSearchOrderId(e.target.value)}
              placeholder="Search Order ID..."
              className="bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg pl-8 pr-3 py-1 text-sm w-48"
            />
          </div>

          {/* Action buttons */}
          <button
            onClick={applyFilters}
            className="bg-primary text-white px-4 py-1 rounded-lg text-sm hover:bg-primary/90"
          >
            Apply
          </button>
          {(fromDate || toDate || statusFilter || searchOrderId) && (
            <button
              onClick={clearFilters}
              className="text-xs px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200"
            >
              <X className="w-3 h-3 inline mr-1" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No logs found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700/50">
                <tr>
                  <th className="p-3 text-left">Date & Time</th>
                  <th className="p-3 text-left">Order ID</th>
                  <th className="p-3 text-left">Customer</th>
                  <th className="p-3 text-left">Status Change</th>
                  <th className="p-3 text-right">Order Total</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.Id}
                    className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  >
                    <td className="p-3">
                      <div className="font-medium">
                        {new Date(log.ChangedAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(log.ChangedAt).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono text-xs">
                        {log.OrderId.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{log.Customer || "Walk-in"}</div>
                      {log.CustomerPhone && (
                        <div className="text-xs text-gray-500">{log.CustomerPhone}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {log.OldStatus ? (
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              STATUS_COLORS[log.OldStatus] || "bg-gray-100"
                            }`}
                          >
                            {log.OldStatus}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">New</span>
                        )}
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            STATUS_COLORS[log.NewStatus] || "bg-gray-100"
                          }`}
                        >
                          {log.NewStatus}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-right font-semibold">
                      Rs {Number(log.OrderTotal || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500">
              Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, total)} of {total}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
