"use client";

import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  getCategories,
  getProducts,
  getSizes,
  getColors,
  runInventoryReport,
  runSalesReport,
  runExpensesReport,
  runPnLReport,
  runDeadStockReport,
} from "./actions";
import { BarChart2, Filter, Package, TrendingUp, Receipt, Trash2, PieChart } from "lucide-react";

type Option = { Id: string; Name: string };

type Filters = {
  category: string;
  product: string;
  size: string;
  color: string;
  from: string;
  to: string;
};

type InventoryRow = {
  Category: string;
  Product: string;
  Size: string;
  Color: string;
  Qty: number;
};

export default function ReportPage() {
  const [categories, setCategories] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [sizes, setSizes] = useState<Option[]>([]);
  const [colors, setColors] = useState<Option[]>([]);

  const [filters, setFilters] = useState<Filters>({
    category: "",
    product: "",
    size: "",
    color: "",
    from: "",
    to: "",
  });

  const [activeTab, setActiveTab] = useState<"inventory" | "sales" | "expenses" | "pnl" | "deadStock">("inventory");

  const [inventoryData, setInventoryData] = useState<InventoryRow[] | null>(null);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [expensesData, setExpensesData] = useState<any[]>([]);
  const [pnlData, setPnlData] = useState<any | null>(null);
  const [deadStockData, setDeadStockData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const tabs: Array<"inventory" | "sales" | "expenses" | "pnl" | "deadStock"> = ["inventory", "sales", "expenses", "pnl", "deadStock"];

  // Load dropdowns initially
  useEffect(() => {
    (async () => {
      try {
        const [c, s, col, pAll] = await Promise.all([
          getCategories(),
          getSizes(),
          getColors(),
          getProducts(),
        ]);
        setCategories(c);
        setSizes(s);
        setColors(col);
        setProducts(pAll);
      } catch (e: any) {
        toast.error(e.message || "Failed to load filters");
      }
    })();
  }, []);

  // When category changes, refetch products
  useEffect(() => {
    (async () => {
      try {
        setFilters((f) => ({ ...f, product: "" }));
        const prods = await getProducts(filters.category || undefined);
        setProducts(prods);
      } catch (e: any) {
        toast.error(e.message || "Failed to load products");
      }
    })();
  }, [filters.category]);

  async function runReport() {
    setLoading(true);
    try {
      if (activeTab === "inventory") {
        setInventoryData(await runInventoryReport(filters));
      }
      if (activeTab === "sales") {
        setSalesData(await runSalesReport(filters));
      }
      if (activeTab === "expenses") {
        setExpensesData(await runExpensesReport(filters));
      }
      if (activeTab === "pnl") {
        setPnlData(await runPnLReport(filters.from, filters.to));
      }
      if (activeTab === "deadStock") {
        setDeadStockData(await runDeadStockReport(filters));
      }
      toast.success("Report generated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to run report");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-primary/20 p-3 rounded-lg">
          <BarChart2 className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Reports & Analytics</h1>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary" />
          Filters
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.Id} value={c.Id}>{c.Name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Product</label>
            <select
              value={filters.product}
              onChange={(e) => setFilters((f) => ({ ...f, product: e.target.value }))}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.Id} value={p.Id}>{p.Name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Size</label>
            <select
              value={filters.size}
              onChange={(e) => setFilters((f) => ({ ...f, size: e.target.value }))}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="">All Sizes</option>
              {sizes.map((s) => (
                <option key={s.Id} value={s.Id}>{s.Name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Color</label>
            <select
              value={filters.color}
              onChange={(e) => setFilters((f) => ({ ...f, color: e.target.value }))}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="">All Colors</option>
              {colors.map((c) => (
                <option key={c.Id} value={c.Id}>{c.Name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">From Date</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">To Date</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={runReport}
            disabled={loading}
            className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg px-6 py-3 flex items-center gap-2 disabled:opacity-60 transition-colors"
          >
            <Filter className="w-4 h-4" />
            {loading ? "Generating..." : `Generate ${activeTab === 'pnl' ? 'P&L' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report`}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium rounded-lg whitespace-nowrap transition-all ${
              activeTab === tab
                ? "bg-primary text-white shadow-lg"
                : "bg-white dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-gray-200 dark:border-gray-700"
            }`}
          >
            {tab === "pnl" ? "P & L" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Report Data */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {/* Inventory */}
        {activeTab === "inventory" && (
          <>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" /> Inventory Report
              </h2>
            </div>
            {!inventoryData ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Click "Generate Report" to view inventory data</p>
              </div>
            ) : inventoryData.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p>No inventory data found for the selected filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-gray-700/50">
                    <tr>
                      <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Category</th>
                      <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Product</th>
                      <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Size</th>
                      <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Color</th>
                      <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryData.map((row, i) => (
                      <tr key={i} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="p-4">{row.Category}</td>
                        <td className="p-4 font-medium">{row.Product}</td>
                        <td className="p-4">{row.Size}</td>
                        <td className="p-4">{row.Color}</td>
                        <td className="p-4 font-semibold">{row.Qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Sales */}
        {activeTab === "sales" && (
          <>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> Sales Report
              </h2>
            </div>
            {!salesData ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Click "Generate Report" to view sales data</p>
              </div>
            ) : salesData.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p>No sales data found for the selected filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-gray-700/50">
                    <tr>
                      <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Product</th>
                      <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Qty Sold</th>
                      <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.map((row, i) => (
                      <tr key={i} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="p-4 font-medium">{row.Product}</td>
                        <td className="p-4">{row.Qty}</td>
                        <td className="p-4 font-semibold text-green-600 dark:text-green-400">Rs {row.Revenue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Expenses */}
        {activeTab === "expenses" && (
          <>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" /> Expenses Report
              </h2>
            </div>
            {!expensesData ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <Receipt className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Click "Generate Report" to view expenses data</p>
              </div>
            ) : expensesData.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p>No expenses data found for the selected filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-gray-700/50">
                    <tr>
                      <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Description</th>
                      <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                      <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expensesData.map((row, i) => (
                      <tr key={i} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="p-4">{row.Description}</td>
                        <td className="p-4 font-semibold text-red-600 dark:text-red-400">Rs {row.Amount}</td>
                        <td className="p-4 text-gray-600 dark:text-gray-400">
                          {new Date(row.UsageDate).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* P&L */}
        {activeTab === "pnl" && (
          <>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <PieChart className="w-5 h-5 text-primary" /> Profit & Loss Statement
              </h2>
            </div>
            {!pnlData ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <PieChart className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Click "Generate Report" to view P&L statement</p>
              </div>
            ) : (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <p className="text-sm font-medium text-green-800 dark:text-green-300">Revenue</p>
                    </div>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">Rs {pnlData.Revenue}</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Receipt className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <p className="text-sm font-medium text-red-800 dark:text-red-300">Cost of Goods Sold</p>
                    </div>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">Rs {pnlData.COGS}</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <PieChart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Gross Profit</p>
                    </div>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">Rs {pnlData.GrossProfit}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Dead Stock */}
        {activeTab === "deadStock" && (
          <>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-primary" /> Dead Stock Report
              </h2>
            </div>
            {!deadStockData ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <Trash2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Click "Generate Report" to view dead stock items</p>
              </div>
            ) : deadStockData.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p>No dead stock items found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-gray-700/50">
                    <tr>
                      <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Product</th>
                      <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deadStockData.map((row, i) => (
                      <tr key={i} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="p-4 font-medium">{row.Product}</td>
                        <td className="p-4 font-semibold text-orange-600 dark:text-orange-400">{row.Qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}