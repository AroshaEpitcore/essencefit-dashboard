"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Package,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Boxes,
  ShoppingCart,
  Banknote,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import {
  getDashboardStats,
  getLowStockItems,
  getChartData,
  getAnalyticsData,
} from "./actions";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
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
];

const STATUS_COLORS_CHART: Record<string, string> = {
  Pending: "#f59e0b",
  Paid: "#22c55e",
  Partial: "#3b82f6",
  Completed: "#10b981",
  Canceled: "#ef4444",
};

type DashboardStats = {
  TotalStock: number;
  TodaysSales: number;
  ThisMonthSales: number;
  ThisMonthProfit: number;
  UnitsSoldToday: number;
  UnitsSoldMonth: number;
  AllTimeUnitsSold: number;
  ExpensesMonth: number;
  ThisMonthNet: number;
  AllTimeSales: number;
  AllTimeProfit: number;
  Products: number;
  Variants: number;
  LowStock: number;

  OrdersToday: number;
  OrdersMonth: number;
  NewOrdersCount: number;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [dailySales, setDailySales] = useState<any[]>([]);
  const [weeklySales, setWeeklySales] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [revenueByCategory, setRevenueByCategory] = useState<any[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<any[]>([]);

  async function loadDashboard() {
    try {
      const [s, l, c, a] = await Promise.all([
        getDashboardStats(),
        getLowStockItems(),
        getChartData(),
        getAnalyticsData(),
      ]);
      setStats(s);
      setLowStock(l.lowStockItems);
      setChartData(c.monthly);
      setDailySales(c.daily);
      setWeeklySales(a.weekly);
      setTopProducts(a.topProducts);
      setRevenueByCategory(a.revenueByCategory);
      setOrdersByStatus(a.ordersByStatus);
    } catch (e: any) {
      toast.error(e.message || "Failed to load dashboard data");
    }
  }

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      <h1 className="text-xl font-bold mb-8 flex items-center gap-2">
        <Package className="w-7 h-7 text-primary" />
        Dashboard
      </h1>

      {!stats ? (
        <p className="text-gray-500 text-center py-12">Loading…</p>
      ) : (
        <>
          {stats.NewOrdersCount > 0 && (
            <div className="relative overflow-hidden text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl px-6 py-10 mb-10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold mb-1">Congratulations 🎉</h2>
                <p className="text-sm opacity-90 mb-3">
                  You have new pending orders. Check and confirm them.
                </p>
                <div className="text-lg font-semibold">
                  {stats.NewOrdersCount} new orders
                  <span className="ml-2 text-sm font-normal opacity-80">
                    Pending
                  </span>
                </div>
              </div>

              <img
                src="/dashboard-image.png"
                alt="Dashboard Illustration"
                className="dashboard-image absolute bottom-0 right-0 w-[230px] md:w-[270px] object-contain"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <Card
              title="Total Stock (pcs)"
              value={stats.TotalStock}
              icon={<Boxes className="w-5 h-5" />}
              color="bg-blue-500/20 text-blue-600 dark:text-blue-400"
            />
            <Card
              title="Today's Sales (Net)"
              value={`Rs ${Number(stats.TodaysSales).toFixed(2)}`}
              icon={<DollarSign className="w-5 h-5" />}
              color="bg-green-500/20 text-green-600 dark:text-green-400"
            />
            <Card
              title="This Month Sales (Net)"
              value={`Rs ${Number(stats.ThisMonthSales).toFixed(2)}`}
              icon={<TrendingUp className="w-5 h-5" />}
              color="bg-green-500/20 text-green-600 dark:text-green-400"
            />
            <Card
              title="This Month Profit"
              value={`Rs ${Number(stats.ThisMonthProfit).toFixed(2)}`}
              icon={<Banknote className="w-5 h-5" />}
              color="bg-purple-500/20 text-purple-600 dark:text-purple-400"
            />

            <Card
              title="Orders Today"
              value={stats.OrdersToday}
              icon={<ClipboardList className="w-5 h-5" />}
              color="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
            />
            <Card
              title="Orders This Month"
              value={stats.OrdersMonth}
              icon={<ClipboardList className="w-5 h-5" />}
              color="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
            />

            <Card
              title="Units Sold Today"
              value={stats.UnitsSoldToday}
              icon={<ShoppingCart className="w-5 h-5" />}
              color="bg-orange-500/20 text-orange-600 dark:text-orange-400"
            />
            <Card
              title="Units Sold (Month)"
              value={stats.UnitsSoldMonth}
              icon={<ShoppingCart className="w-5 h-5" />}
              color="bg-orange-500/20 text-orange-600 dark:text-orange-400"
            />
            <Card
              title="All-time Units Sold"
              value={stats.AllTimeUnitsSold}
              icon={<ShoppingCart className="w-5 h-5" />}
              color="bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
            />
            <Card
              title="Expenses (Month)"
              value={`Rs ${Number(stats.ExpensesMonth).toFixed(2)}`}
              icon={<TrendingDown className="w-5 h-5" />}
              color="bg-red-500/20 text-red-600 dark:text-red-400"
            />
            <Card
              title="This Month Net"
              value={`Rs ${Number(stats.ThisMonthNet).toFixed(2)}`}
              icon={<DollarSign className="w-5 h-5" />}
              color="bg-teal-500/20 text-teal-600 dark:text-teal-400"
            />
            <Card
              title="All-time Sales (Net)"
              value={`Rs ${Number(stats.AllTimeSales).toFixed(2)}`}
              icon={<DollarSign className="w-5 h-5" />}
              color="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
            />
            <Card
              title="All-time Profit"
              value={`Rs ${Number(stats.AllTimeProfit).toFixed(2)}`}
              icon={<Banknote className="w-5 h-5" />}
              color="bg-purple-500/20 text-purple-600 dark:text-purple-400"
            />
            <Card
              title="Products"
              value={stats.Products}
              icon={<Package className="w-5 h-5" />}
              color="bg-gray-500/20 text-gray-600 dark:text-gray-400"
            />
            <Card
              title="Variants"
              value={stats.Variants}
              icon={<Boxes className="w-5 h-5" />}
              color="bg-gray-500/20 text-gray-600 dark:text-gray-400"
            />
            <Card
              title="Low-stock Items"
              value={stats.LowStock}
              icon={<TrendingDown className="w-5 h-5" />}
              color="bg-red-500/20 text-red-600 dark:text-red-400"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4">
                Monthly Sales (Net) vs Profit
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sales" fill="#22c55e" name="Sales (Net)" />
                  <Bar dataKey="profit" fill="#8b5cf6" name="Profit" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4">
                Daily Sales (Net) (Last 14 Days)
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailySales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#3b82f6"
                    name="Sales (Net)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Weekly Sales Trend */}
            <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4">
                Weekly Sales (Last 8 Weeks)
              </h2>
              {weeklySales.length === 0 ? (
                <p className="text-gray-500 text-center py-12">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={weeklySales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => [
                        `Rs ${Number(value).toFixed(2)}`,
                        "Sales",
                      ]}
                    />
                    <Bar dataKey="sales" fill="#3b82f6" name="Sales (Net)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top 10 Products */}
            <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4">
                Top 10 Products (This Month)
              </h2>
              {topProducts.length === 0 ? (
                <p className="text-gray-500 text-center py-12">No sales this month</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topProducts} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        name === "qty"
                          ? `${value} pcs`
                          : `Rs ${Number(value).toFixed(2)}`,
                        name === "qty" ? "Qty Sold" : "Revenue",
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="qty" fill="#22c55e" name="Qty Sold" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Revenue by Category */}
            <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4">
                Revenue by Category (This Month)
              </h2>
              {revenueByCategory.length === 0 ? (
                <p className="text-gray-500 text-center py-12">No data</p>
              ) : (
                <div className="flex items-center">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={revenueByCategory}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={50}
                        dataKey="revenue"
                        nameKey="name"
                        label={({ name, percent }: any) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={true}
                      >
                        {revenueByCategory.map((_: any, i: number) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [
                          `Rs ${Number(value).toFixed(2)}`,
                          "Revenue",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Orders by Payment Status */}
            <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4">
                Orders by Status (This Month)
              </h2>
              {ordersByStatus.length === 0 ? (
                <p className="text-gray-500 text-center py-12">No orders</p>
              ) : (
                <div className="flex items-center">
                  <ResponsiveContainer width="60%" height={300}>
                    <PieChart>
                      <Pie
                        data={ordersByStatus}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={50}
                        dataKey="count"
                        nameKey="name"
                      >
                        {ordersByStatus.map((entry: any, i: number) => (
                          <Cell
                            key={i}
                            fill={
                              STATUS_COLORS_CHART[entry.name] ||
                              PIE_COLORS[i % PIE_COLORS.length]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [
                          `${value} orders`,
                          "Count",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-[40%] space-y-2">
                    {ordersByStatus.map((entry: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              STATUS_COLORS_CHART[entry.name] ||
                              PIE_COLORS[i % PIE_COLORS.length],
                          }}
                        />
                        <span className="text-gray-600 dark:text-gray-400">
                          {entry.name}
                        </span>
                        <span className="ml-auto font-semibold">
                          {entry.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Low-stock Products
            </h2>

            {lowStock.length === 0 ? (
              <p className="text-gray-500 text-center py-6">
                All stocks are healthy 🎉
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-700/50">
                    <tr>
                      <th className="p-3 text-left">Product</th>
                      <th className="p-3 text-left">Size</th>
                      <th className="p-3 text-left">Color</th>
                      <th className="p-3 text-center">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map((item) => (
                      <tr
                        key={item.VariantId}
                        className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                      >
                        <td className="p-3">{item.ProductName}</td>
                        <td className="p-3">{item.SizeName}</td>
                        <td className="p-3">{item.ColorName}</td>
                        <td className="p-3 text-center font-semibold text-red-500">
                          {item.Qty}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Card({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </h3>
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}