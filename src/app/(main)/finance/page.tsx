"use client";

import { useEffect, useState } from "react";
import {
  getFinanceSummary,
  getProductProfit,
  recordHandover,
  recordCashUsage,
  getRecentHandovers,
  getRecentCashUsages,
} from "./actions";
import toast, { Toaster } from "react-hot-toast";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  HandCoins,
  Receipt,
  Clock,
} from "lucide-react";

export default function FinancePage() {
  const [summary, setSummary] = useState<any>(null);
  const [profits, setProfits] = useState<any[]>([]);
  const [handovers, setHandovers] = useState<any[]>([]);
  const [cashUsages, setCashUsages] = useState<any[]>([]);
  const [handover, setHandover] = useState({ amount: "", manager: "" });
  const [cash, setCash] = useState({ amount: "", reason: "" });

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const s = await getFinanceSummary();
    const p = await getProductProfit();
    const h = await getRecentHandovers();
    const c = await getRecentCashUsages();
    setSummary(s);
    setProfits(p);
    setHandovers(h);
    setCashUsages(c);
  }

  async function saveHandover() {
    if (handover.amount === "" || handover.manager.trim() === "") {
      toast.error("Please fill both amount and manager");
      return;
    }
    try {
      await recordHandover(handover.manager.trim(), Number(handover.amount));
      toast.success("Handover recorded");
      setHandover({ amount: "", manager: "" });
      refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to record handover");
    }
  }

  async function saveCash() {
    if (cash.amount === "" || cash.reason.trim() === "") {
      toast.error("Please fill both amount and reason");
      return;
    }
    try {
      await recordCashUsage(cash.reason.trim(), Number(cash.amount));
      toast.success("Cash usage recorded");
      setCash({ amount: "", reason: "" });
      refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to record cash usage");
    }
  }

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-primary/20 p-3 rounded-lg">
          <Wallet className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Finance</h1>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card 
            title="All-Time Sales" 
            value={`Rs ${summary.TotalSales}`}
            icon={<TrendingUp className="w-5 h-5" />}
            iconBg="bg-green-500/20"
            iconColor="text-green-600 dark:text-green-400"
          />
          <Card 
            title="Handed Over" 
            value={`Rs ${summary.HandedOver}`}
            icon={<HandCoins className="w-5 h-5" />}
            iconBg="bg-blue-500/20"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <Card 
            title="Cash Used" 
            value={`Rs ${summary.CashUsed}`}
            icon={<TrendingDown className="w-5 h-5" />}
            iconBg="bg-orange-500/20"
            iconColor="text-orange-600 dark:text-orange-400"
          />
          <Card 
            title="Remaining Balance" 
            value={`Rs ${summary.Remaining}`}
            icon={<Wallet className="w-5 h-5" />}
            iconBg="bg-purple-500/20"
            iconColor="text-purple-600 dark:text-purple-400"
          />
        </div>
      )}

      {/* Product Profit */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary" />
          Product Profit
        </h2>
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700/50">
                <tr>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Product</th>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Sold Qty</th>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Revenue</th>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Cost</th>
                  <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Profit</th>
                </tr>
              </thead>
              <tbody>
                {profits.map((p) => (
                  <tr key={p.ProductId} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="p-4 font-medium">{p.ProductName}</td>
                    <td className="p-4">{p.TotalSoldQty}</td>
                    <td className="p-4">Rs {p.TotalRevenue}</td>
                    <td className="p-4">Rs {p.TotalCost}</td>
                    <td className="p-4 font-bold text-green-600 dark:text-green-400">
                      Rs {p.Profit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {profits.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No profit data available yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* Money Handover */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <HandCoins className="w-5 h-5 text-primary" />
          Money Handover
        </h2>
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Amount
              </label>
              <input
                type="number"
                placeholder="Enter amount"
                value={handover.amount}
                onChange={(e) =>
                  setHandover({ ...handover, amount: e.target.value })
                }
                className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Manager User ID
              </label>
              <input
                type="text"
                placeholder="Enter manager ID"
                value={handover.manager}
                onChange={(e) =>
                  setHandover({ ...handover, manager: e.target.value })
                }
                className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={saveHandover} 
                className="w-full bg-primary hover:bg-primary/90 transition-colors px-6 py-3 rounded-lg font-semibold text-white"
              >
                Record Handover
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Handovers */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Recent Handovers
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {handovers.map((h) => (
            <div
              key={h.Id}
              className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="bg-blue-500/20 p-2 rounded-lg">
                  <HandCoins className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">Rs {h.Amount}</p>
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Manager: {h.ManagerName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(h.HandoverDate).toLocaleString()}
              </p>
            </div>
          ))}
          {handovers.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
              <HandCoins className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No handovers recorded yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* Cash Usage */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          Cash Usage
        </h2>
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Amount
              </label>
              <input
                type="number"
                placeholder="Enter amount"
                value={cash.amount}
                onChange={(e) => setCash({ ...cash, amount: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason
              </label>
              <input
                type="text"
                placeholder="Enter reason"
                value={cash.reason}
                onChange={(e) => setCash({ ...cash, reason: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={saveCash} 
                className="w-full bg-primary hover:bg-primary/90 transition-colors px-6 py-3 rounded-lg font-semibold text-white"
              >
                Record Cash
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Cash Usage */}
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Recent Cash Usage
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cashUsages.map((c) => (
            <div
              key={c.Id}
              className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="bg-orange-500/20 p-2 rounded-lg">
                  <Wallet className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">Rs {c.Amount}</p>
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {c.Description}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(c.UsageDate).toLocaleString()}
              </p>
            </div>
          ))}
          {cashUsages.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
              <Wallet className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No cash usage recorded yet.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Card({ 
  title, 
  value, 
  icon, 
  iconBg, 
  iconColor 
}: { 
  title: string; 
  value: string; 
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h3>
        <div className={`${iconBg} p-2 rounded-lg ${iconColor}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}