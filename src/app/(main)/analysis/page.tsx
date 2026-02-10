"use client";

import { useEffect, useState, useCallback } from "react";
import toast, { Toaster } from "react-hot-toast";
import { getAnalysisData } from "./actions";
import {
  BarChart3,
  AlertTriangle,
  Trophy,
  TrendingUp,
  Users,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const PIE_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#6366f1",
  "#84cc16", "#f43f5e", "#0ea5e9", "#a855f7", "#fb923c",
];

const STATUS_COLORS: Record<string, string> = {
  Pending: "#f59e0b",
  Partial: "#3b82f6",
  Paid: "#22c55e",
  Completed: "#10b981",
  Canceled: "#ef4444",
};

const STATUS_BG: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  Partial: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  Completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Canceled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

type QuickRange = "thisMonth" | "lastMonth" | "last3" | "last6" | "thisYear" | "all";

function getQuickRange(key: QuickRange): { from: string | null; to: string | null } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const today = fmt(now);

  switch (key) {
    case "thisMonth":
      return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case "lastMonth": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmt(s), to: fmt(e) };
    }
    case "last3":
      return { from: fmt(new Date(now.getFullYear(), now.getMonth() - 3, 1)), to: today };
    case "last6":
      return { from: fmt(new Date(now.getFullYear(), now.getMonth() - 6, 1)), to: today };
    case "thisYear":
      return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: today };
    case "all":
      return { from: null, to: null };
  }
}

const QUICK_OPTIONS: Array<{ key: QuickRange; label: string }> = [
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "last3", label: "Last 3 Months" },
  { key: "last6", label: "Last 6 Months" },
  { key: "thisYear", label: "This Year" },
  { key: "all", label: "All Time" },
];

export default function AnalysisPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeQuick, setActiveQuick] = useState<QuickRange>("thisMonth");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const loadData = useCallback(async (from: string | null, to: string | null) => {
    try {
      setLoading(true);
      const result = await getAnalysisData({ from, to });
      setData(result);
    } catch (e: any) {
      toast.error(e.message || "Failed to load analysis data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const r = getQuickRange("thisMonth");
    setFromDate(r.from || "");
    setToDate(r.to || "");
    loadData(r.from, r.to);
  }, [loadData]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(fromDate || null, toDate || null);
    }, 60000);
    return () => clearInterval(interval);
  }, [fromDate, toDate, loadData]);

  function handleQuick(key: QuickRange) {
    setActiveQuick(key);
    const r = getQuickRange(key);
    setFromDate(r.from || "");
    setToDate(r.to || "");
    loadData(r.from, r.to);
  }

  function handleCustomDate() {
    setActiveQuick("all");
    loadData(fromDate || null, toDate || null);
  }

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-primary/20 p-3 rounded-lg">
          <BarChart3 className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Analysis</h1>
        {!loading && (
          <button
            onClick={() => loadData(fromDate || null, toDate || null)}
            className="ml-auto text-gray-400 hover:text-primary transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Date Filter */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleQuick(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeQuick === opt.key
                  ? "bg-primary text-white shadow-md"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}

          <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>

          <label className="text-xs text-gray-500">From:</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-sm"
          />
          <label className="text-xs text-gray-500">To:</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-sm"
          />
          <button
            onClick={handleCustomDate}
            className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium"
          >
            Apply
          </button>
        </div>
      </div>

      {loading && !data ? (
        <p className="text-gray-500 text-center py-12">Loading analysis...</p>
      ) : !data ? null : (
        <>
          {/* Row 1: Colors, Sizes, Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Best Selling Colors */}
            <ChartCard title="Best Selling Colors" icon={<div className="w-4 h-4 rounded-full bg-gradient-to-r from-pink-500 to-blue-500" />}>
              {data.topColors.length === 0 ? <NoData /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={data.topColors}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={45}
                      dataKey="qty"
                      nameKey="name"
                      label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={true}
                    >
                      {data.topColors.map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v} pcs`, "Sold"]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Best Selling Sizes */}
            <ChartCard title="Best Selling Sizes" icon={<div className="w-4 h-4 rounded bg-blue-500" />}>
              {data.topSizes.length === 0 ? <NoData /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={data.topSizes}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={45}
                      dataKey="qty"
                      nameKey="name"
                      label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={true}
                    >
                      {data.topSizes.map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v} pcs`, "Sold"]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Best Selling Categories */}
            <ChartCard title="Revenue by Category" icon={<Trophy className="w-4 h-4" />}>
              {data.topCategories.length === 0 ? <NoData /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={data.topCategories}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={45}
                      dataKey="revenue"
                      nameKey="name"
                      label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={true}
                    >
                      {data.topCategories.map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`Rs ${Number(v).toFixed(2)}`, "Revenue"]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Row 2: Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <ChartCard title="Top 15 Products (by Qty)" icon={<Trophy className="w-4 h-4" />}>
              {data.topProducts.length === 0 ? <NoData /> : (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={data.topProducts} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number, name: string) => [
                        name === "qty" ? `${v} pcs` : `Rs ${Number(v).toFixed(2)}`,
                        name === "qty" ? "Qty Sold" : "Revenue",
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="qty" fill="#22c55e" name="Qty Sold" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Sales by Day of Week */}
            <ChartCard title="Sales by Day of Week" icon={<BarChart3 className="w-4 h-4" />}>
              {data.dayOfWeek.length === 0 ? <NoData /> : (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={data.dayOfWeek}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" orientation="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      formatter={(v: number, name: string) => [
                        name === "qty" ? `${v} pcs` : `Rs ${Number(v).toFixed(2)}`,
                        name === "qty" ? "Units" : "Revenue",
                      ]}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="qty" fill="#3b82f6" name="Units" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="revenue" fill="#8b5cf6" name="Revenue" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Row 3: Monthly Sales Trend + Daily Sales */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <ChartCard title="Monthly Sales Trend" icon={<TrendingUp className="w-4 h-4" />}>
              {data.monthlySales.length === 0 ? <NoData /> : (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={data.monthlySales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip formatter={(v: number) => [`Rs ${Number(v).toFixed(2)}`]} />
                    <Legend />
                    <Line type="monotone" dataKey="grossSales" stroke="#f59e0b" name="Gross Sales" strokeWidth={2} />
                    <Line type="monotone" dataKey="netSales" stroke="#3b82f6" name="Net Sales" strokeWidth={2} />
                    <Line type="monotone" dataKey="profit" stroke="#22c55e" name="Profit" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Daily Sales" icon={<TrendingUp className="w-4 h-4" />}>
              {data.dailySales.length === 0 ? <NoData /> : (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={data.dailySales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip formatter={(v: number) => [`Rs ${Number(v).toFixed(2)}`, "Sales"]} />
                    <Area type="monotone" dataKey="sales" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Row 4: Revenue vs Expenses + AOV Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <ChartCard title="Revenue vs Expenses" icon={<BarChart3 className="w-4 h-4" />}>
              {data.revenueVsExpenses.length === 0 ? <NoData /> : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={data.revenueVsExpenses}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip formatter={(v: number) => [`Rs ${Number(v).toFixed(2)}`]} />
                    <Legend />
                    <Bar dataKey="revenue" fill="#22c55e" name="Revenue" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="netProfit" fill="#8b5cf6" name="Net Profit" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Average Order Value Trend" icon={<TrendingUp className="w-4 h-4" />}>
              {data.aovTrend.length === 0 ? <NoData /> : (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={data.aovTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip
                      formatter={(v: number, name: string) => [
                        name === "orders" ? v : `Rs ${Number(v).toFixed(2)}`,
                        name === "orders" ? "Orders" : "AOV",
                      ]}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="aov" stroke="#f59e0b" name="AOV" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="orders" stroke="#3b82f6" name="Orders" strokeWidth={1} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Row 5: Order Status + Customer Leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Order Status Breakdown */}
            <ChartCard title="Order Status Breakdown" icon={<BarChart3 className="w-4 h-4" />}>
              {data.orderStatus.length === 0 ? <NoData /> : (
                <div>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.orderStatus} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={90} />
                      <Tooltip
                        formatter={(v: number, name: string) => [
                          name === "count" ? `${v} orders` : `Rs ${Number(v).toFixed(2)}`,
                          name === "count" ? "Orders" : "Total",
                        ]}
                      />
                      <Bar dataKey="count" name="Orders" radius={[0, 4, 4, 0]}>
                        {data.orderStatus.map((entry: any, i: number) => (
                          <Cell key={i} fill={STATUS_COLORS[entry.name] || PIE_COLORS[i]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {data.orderStatus.map((s: any) => (
                      <div key={s.name} className={`text-xs px-3 py-1.5 rounded-lg font-medium ${STATUS_BG[s.name] || "bg-gray-100 dark:bg-gray-800"}`}>
                        {s.name}: {s.count} orders - Rs {Number(s.total).toFixed(2)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ChartCard>

            {/* Customer Leaderboard */}
            <ChartCard title="Top 20 Customers" icon={<Users className="w-4 h-4" />}>
              {data.customerLeaderboard.length === 0 ? <NoData /> : (
                <div className="overflow-auto max-h-[340px]">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-700/50 sticky top-0">
                      <tr>
                        <th className="p-2 text-left">#</th>
                        <th className="p-2 text-left">Customer</th>
                        <th className="p-2 text-left">Phone</th>
                        <th className="p-2 text-center">Orders</th>
                        <th className="p-2 text-right">Total Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.customerLeaderboard.map((c: any, i: number) => (
                        <tr key={i} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="p-2 font-semibold text-gray-400">{i + 1}</td>
                          <td className="p-2 font-medium">{c.name}</td>
                          <td className="p-2 text-xs text-gray-500">{c.phone || "-"}</td>
                          <td className="p-2 text-center">{c.orders}</td>
                          <td className="p-2 text-right font-semibold text-green-600 dark:text-green-400">
                            Rs {Number(c.totalSpent).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCard>
          </div>

          {/* Row 6: Restock Alerts */}
          <ChartCard title="Restock Alerts (Qty < 10)" icon={<AlertTriangle className="w-4 h-4 text-red-500" />}>
            {data.restockAlerts.length === 0 ? (
              <p className="text-gray-500 text-center py-6">All stocks are healthy</p>
            ) : (
              <div className="overflow-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-700/50 sticky top-0">
                    <tr>
                      <th className="p-3 text-left">Product</th>
                      <th className="p-3 text-left">Size</th>
                      <th className="p-3 text-left">Color</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-left">Last Sold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.restockAlerts.map((item: any) => (
                      <tr key={item.VariantId} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="p-3 font-medium">{item.ProductName}</td>
                        <td className="p-3">{item.SizeName}</td>
                        <td className="p-3">{item.ColorName}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            item.Qty === 0
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : item.Qty <= 3
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          }`}>
                            {item.Qty}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-gray-500">
                          {item.LastSold
                            ? new Date(item.LastSold).toLocaleDateString()
                            : "Never"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        </>
      )}
    </div>
  );
}

function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function NoData() {
  return <p className="text-gray-500 text-center py-12 text-sm">No data for this period</p>;
}
