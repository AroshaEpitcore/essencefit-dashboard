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
} from "lucide-react";
import { getDashboardStats, getLowStockItems, getChartData } from "./actions";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type DashboardStats = {
  TotalStock: number;
  TodaysSales: number;
  ThisMonthSales: number;
  ThisMonthProfit: number;
  UnitsSoldToday: number;
  UnitsSoldMonth: number;
  ExpensesMonth: number;
  ThisMonthNet: number;
  AllTimeSales: number;
  AllTimeProfit: number;
  Products: number;
  Variants: number;
  LowStock: number;
  NewOrdersCount: number;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [dailySales, setDailySales] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [s, l, c] = await Promise.all([
          getDashboardStats(),
          getLowStockItems(),
          getChartData(),
        ]);
        setStats(s);
        setLowStock(l.lowStockItems);
        setChartData(c.monthly);
        setDailySales(c.daily);
      } catch (e: any) {
        toast.error(e.message || "Failed to load dashboard data");
      }
    })();
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
          {/* === Congratulations Section === */}
          {stats?.NewOrdersCount > 0 && (
            <div className="relative overflow-hidden text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl px-6 py-10 mb-10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold mb-1">
                  Congratulations 🎉
                </h2>
                <p className="text-sm opacity-90 mb-3">
                  You have more sales this week check your new orders.
                </p>
                <div className="text-lg font-semibold">
                  {stats.NewOrdersCount} new orders
                  <span className="ml-2 text-sm font-normal opacity-80">
                    Processing
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

          {/* === Stats Cards === */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <Card
              title="Total Stock (pcs)"
              value={stats.TotalStock}
              icon={<Boxes className="w-5 h-5" />}
              color="bg-blue-500/20 text-blue-600 dark:text-blue-400"
            />
            <Card
              title="Today's Sales"
              value={`Rs ${stats.TodaysSales}`}
              icon={<DollarSign className="w-5 h-5" />}
              color="bg-green-500/20 text-green-600 dark:text-green-400"
            />
            <Card
              title="This Month Sales"
              value={`Rs ${stats.ThisMonthSales}`}
              icon={<TrendingUp className="w-5 h-5" />}
              color="bg-green-500/20 text-green-600 dark:text-green-400"
            />
            <Card
              title="This Month Profit"
              value={`Rs ${stats.ThisMonthProfit}`}
              icon={<Banknote className="w-5 h-5" />}
              color="bg-purple-500/20 text-purple-600 dark:text-purple-400"
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
              title="Expenses (Month)"
              value={`Rs ${stats.ExpensesMonth}`}
              icon={<TrendingDown className="w-5 h-5" />}
              color="bg-red-500/20 text-red-600 dark:text-red-400"
            />
            <Card
              title="This Month Net"
              value={`Rs ${stats.ThisMonthNet}`}
              icon={<DollarSign className="w-5 h-5" />}
              color="bg-teal-500/20 text-teal-600 dark:text-teal-400"
            />
            <Card
              title="All-time Sales"
              value={`Rs ${stats.AllTimeSales}`}
              icon={<DollarSign className="w-5 h-5" />}
              color="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
            />
            <Card
              title="All-time Profit"
              value={`Rs ${stats.AllTimeProfit}`}
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

          {/* === Charts Section === */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4">
                Monthly Sales vs Profit
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sales" fill="#22c55e" name="Sales" />
                  <Bar dataKey="profit" fill="#8b5cf6" name="Profit" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4">
                Daily Sales (Last 14 Days)
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
                    name="Sales"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* === Low Stock Table === */}
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
