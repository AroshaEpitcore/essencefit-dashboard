"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  BarChart2,
  Filter,
  Package,
  TrendingUp,
  Receipt,
  Trash2,
  PieChart,
  RefreshCcw,
} from "lucide-react";

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
  Size: string | null;
  Color: string | null;
  Qty: number;
};

type SalesRow = { Product: string; Qty: number; Revenue: number };
type ExpenseRow = { Category: string; Description: string; Amount: number; ExpenseDate: string | Date };
type PnlRow = { Revenue: number; COGS: number; GrossProfit: number };
type DeadRow = { Product: string; Qty: number };

type Tab = "inventory" | "sales" | "expenses" | "pnl" | "deadStock";

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "inventory", label: "Inventory", icon: <Package className="w-4 h-4" /> },
  { key: "sales", label: "Sales", icon: <TrendingUp className="w-4 h-4" /> },
  { key: "expenses", label: "Expenses", icon: <Receipt className="w-4 h-4" /> },
  { key: "pnl", label: "P & L", icon: <PieChart className="w-4 h-4" /> },
  { key: "deadStock", label: "Dead Stock", icon: <Trash2 className="w-4 h-4" /> },
];

function money(n: any) {
  const v = Number(n || 0);
  return `Rs ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function num(n: any) {
  return Number(n || 0).toLocaleString();
}
function fmtDate(d: any) {
  if (!d) return "-";
  const x = new Date(d);
  return x.toLocaleDateString();
}

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

  const [activeTab, setActiveTab] = useState<Tab>("inventory");

  // IMPORTANT: start as null so "Click Generate" messages work
  const [inventoryData, setInventoryData] = useState<InventoryRow[] | null>(null);
  const [salesData, setSalesData] = useState<SalesRow[] | null>(null);
  const [expensesData, setExpensesData] = useState<ExpenseRow[] | null>(null);
  const [pnlData, setPnlData] = useState<PnlRow | null>(null);
  const [deadStockData, setDeadStockData] = useState<DeadRow[] | null>(null);

  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category]);

  // When switching tabs, clear old report result (clean UI)
  useEffect(() => {
    setInventoryData(null);
    setSalesData(null);
    setExpensesData(null);
    setPnlData(null);
    setDeadStockData(null);
    setGeneratedAt(null);
  }, [activeTab]);

  async function runReport() {
    setLoading(true);
    try {
      if (activeTab === "inventory") setInventoryData(await runInventoryReport(filters));
      if (activeTab === "sales") setSalesData(await runSalesReport(filters));
      if (activeTab === "expenses") setExpensesData(await runExpensesReport(filters));
      if (activeTab === "pnl") setPnlData(await runPnLReport(filters.from, filters.to));
      if (activeTab === "deadStock") setDeadStockData(await runDeadStockReport(filters));

      setGeneratedAt(new Date().toLocaleString());
      toast.success("Report generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to run report");
    } finally {
      setLoading(false);
    }
  }

  // KPI summaries
  const invTotalQty = useMemo(
    () => (inventoryData ? inventoryData.reduce((a, r) => a + Number(r.Qty || 0), 0) : 0),
    [inventoryData]
  );

  const salesSummary = useMemo(() => {
    if (!salesData) return { qty: 0, revenue: 0, rows: 0 };
    return {
      rows: salesData.length,
      qty: salesData.reduce((a, r) => a + Number(r.Qty || 0), 0),
      revenue: salesData.reduce((a, r) => a + Number(r.Revenue || 0), 0),
    };
  }, [salesData]);

  const expSummary = useMemo(() => {
    if (!expensesData) return { rows: 0, total: 0 };
    return {
      rows: expensesData.length,
      total: expensesData.reduce((a, r) => a + Number(r.Amount || 0), 0),
    };
  }, [expensesData]);

  const deadSummary = useMemo(() => {
    if (!deadStockData) return { rows: 0 };
    return { rows: deadStockData.length };
  }, [deadStockData]);

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-primary/20 p-3 rounded-lg">
          <BarChart2 className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Reports & Analytics</h1>
          {generatedAt && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Last generated: {generatedAt}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-3 font-medium rounded-lg whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === t.key
                ? "bg-primary text-white shadow-lg"
                : "bg-white dark:bg-gray-800/50 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-gray-200 dark:border-gray-700"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            Filters
          </h2>

          <button
            onClick={() =>
              setFilters({
                category: "",
                product: "",
                size: "",
                color: "",
                from: "",
                to: "",
              })
            }
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Reset
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Field label="Category">
            <select
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              className="w-full input"
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.Id} value={c.Id}>
                  {c.Name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Product">
            <select
              value={filters.product}
              onChange={(e) => setFilters((f) => ({ ...f, product: e.target.value }))}
              className="w-full input"
            >
              <option value="">All</option>
              {products.map((p) => (
                <option key={p.Id} value={p.Id}>
                  {p.Name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Size">
            <select
              value={filters.size}
              onChange={(e) => setFilters((f) => ({ ...f, size: e.target.value }))}
              className="w-full input"
            >
              <option value="">All</option>
              {sizes.map((s) => (
                <option key={s.Id} value={s.Id}>
                  {s.Name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Color">
            <select
              value={filters.color}
              onChange={(e) => setFilters((f) => ({ ...f, color: e.target.value }))}
              className="w-full input"
            >
              <option value="">All</option>
              {colors.map((c) => (
                <option key={c.Id} value={c.Id}>
                  {c.Name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="From">
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className="w-full input"
            />
          </Field>

          <Field label="To">
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className="w-full input"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={runReport}
            disabled={loading}
            className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg px-6 py-3 flex items-center gap-2 disabled:opacity-60 transition-colors"
          >
            <Filter className="w-4 h-4" />
            {loading ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {activeTab === "inventory" && (
          <>
            <Kpi title="Rows" value={inventoryData ? num(inventoryData.length) : "-"} />
            <Kpi title="Total Qty" value={inventoryData ? num(invTotalQty) : "-"} />
            <Kpi title="Date Range" value={filters.from || filters.to ? `${filters.from || "Any"} → ${filters.to || "Any"}` : "Any"} />
          </>
        )}

        {activeTab === "sales" && (
          <>
            <Kpi title="Products" value={salesData ? num(salesSummary.rows) : "-"} />
            <Kpi title="Qty Sold" value={salesData ? num(salesSummary.qty) : "-"} />
            <Kpi title="Revenue" value={salesData ? money(salesSummary.revenue) : "-"} />
          </>
        )}

        {activeTab === "expenses" && (
          <>
            <Kpi title="Records" value={expensesData ? num(expSummary.rows) : "-"} />
            <Kpi title="Total Expenses" value={expensesData ? money(expSummary.total) : "-"} />
            <Kpi title="Date Range" value={filters.from || filters.to ? `${filters.from || "Any"} → ${filters.to || "Any"}` : "Any"} />
          </>
        )}

        {activeTab === "pnl" && (
          <>
            <Kpi title="Revenue" value={pnlData ? money(pnlData.Revenue) : "-"} />
            <Kpi title="COGS" value={pnlData ? money(pnlData.COGS) : "-"} />
            <Kpi title="Gross Profit" value={pnlData ? money(pnlData.GrossProfit) : "-"} />
          </>
        )}

        {activeTab === "deadStock" && (
          <>
            <Kpi title="Dead Items" value={deadStockData ? num(deadSummary.rows) : "-"} />
            <Kpi title="Meaning" value={"Qty = 0"} />
            <Kpi title="Tip" value={"Re-order / discount"} />
          </>
        )}
      </div>

      {/* Results */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            {tabs.find((t) => t.key === activeTab)?.icon}
            {tabs.find((t) => t.key === activeTab)?.label} Report
          </h2>
        </div>

        {/* EMPTY STATE */}
        {activeTab === "inventory" && inventoryData === null && <Empty label="Inventory" />}
        {activeTab === "sales" && salesData === null && <Empty label="Sales" />}
        {activeTab === "expenses" && expensesData === null && <Empty label="Expenses" />}
        {activeTab === "pnl" && pnlData === null && <Empty label="P&L" />}
        {activeTab === "deadStock" && deadStockData === null && <Empty label="Dead Stock" />}

        {/* TABLES */}
        {activeTab === "inventory" && inventoryData && (
          inventoryData.length === 0 ? <NoData /> : (
            <TableWrap>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700/50">
                  <tr>
                    <Th>Category</Th>
                    <Th>Product</Th>
                    <Th>Size</Th>
                    <Th>Color</Th>
                    <Th className="text-right">Qty</Th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryData.map((r, i) => (
                    <tr key={i} className="border-t border-gray-200 dark:border-gray-700 odd:bg-gray-50/60 dark:odd:bg-gray-900/20">
                      <Td>{r.Category}</Td>
                      <Td className="font-medium">{r.Product}</Td>
                      <Td>{r.Size ?? "-"}</Td>
                      <Td>{r.Color ?? "-"}</Td>
                      <Td className="text-right font-semibold">{num(r.Qty)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )
        )}

        {activeTab === "sales" && salesData && (
          salesData.length === 0 ? <NoData /> : (
            <TableWrap>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700/50">
                  <tr>
                    <Th>Product</Th>
                    <Th className="text-right">Qty</Th>
                    <Th className="text-right">Revenue</Th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.map((r, i) => (
                    <tr key={i} className="border-t border-gray-200 dark:border-gray-700 odd:bg-gray-50/60 dark:odd:bg-gray-900/20">
                      <Td className="font-medium">{r.Product}</Td>
                      <Td className="text-right">{num(r.Qty)}</Td>
                      <Td className="text-right font-semibold text-green-600 dark:text-green-400">{money(r.Revenue)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )
        )}

        {activeTab === "expenses" && expensesData && (
          expensesData.length === 0 ? <NoData /> : (
            <TableWrap>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700/50">
                  <tr>
                    <Th>Category</Th>
                    <Th>Description</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Date</Th>
                  </tr>
                </thead>
                <tbody>
                  {expensesData.map((r, i) => (
                    <tr key={i} className="border-t border-gray-200 dark:border-gray-700 odd:bg-gray-50/60 dark:odd:bg-gray-900/20">
                      <Td>{r.Category}</Td>
                      <Td className="font-medium">{r.Description}</Td>
                      <Td className="text-right font-semibold text-red-600 dark:text-red-400">{money(r.Amount)}</Td>
                      <Td>{fmtDate(r.ExpenseDate)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )
        )}

        {activeTab === "pnl" && pnlData && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiBig title="Revenue" value={money(pnlData.Revenue)} />
              <KpiBig title="COGS" value={money(pnlData.COGS)} />
              <KpiBig title="Gross Profit" value={money(pnlData.GrossProfit)} />
            </div>
          </div>
        )}

        {activeTab === "deadStock" && deadStockData && (
          deadStockData.length === 0 ? <NoData /> : (
            <TableWrap>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700/50">
                  <tr>
                    <Th>Product</Th>
                    <Th className="text-right">Qty</Th>
                  </tr>
                </thead>
                <tbody>
                  {deadStockData.map((r, i) => (
                    <tr key={i} className="border-t border-gray-200 dark:border-gray-700 odd:bg-gray-50/60 dark:odd:bg-gray-900/20">
                      <Td className="font-medium">{r.Product}</Td>
                      <Td className="text-right font-semibold text-orange-600 dark:text-orange-400">{num(r.Qty)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )
        )}
      </div>

      {/* Small utility styles */}
      <style jsx global>{`
        .input {
          background: rgba(249, 250, 251, 1);
          border: 1px solid rgba(209, 213, 219, 1);
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          color: inherit;
          outline: none;
          transition: all 0.2s;
        }
        .dark .input {
          background: rgba(31, 41, 55, 0.5);
          border-color: rgba(55, 65, 81, 1);
        }
        .input:focus {
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.5);
          border-color: transparent;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">{title}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}

function KpiBig({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
      <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="text-center py-16 text-gray-500 dark:text-gray-400">
      <p className="text-lg font-medium">No {label} data yet</p>
      <p className="text-sm mt-1">Click “Generate Report” to load results.</p>
    </div>
  );
}

function NoData() {
  return (
    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
      <p>No records found for selected filters.</p>
    </div>
  );
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto max-h-[520px]">{children}</div>;
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`p-4 text-left font-semibold text-gray-700 dark:text-gray-300 ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-4 ${className}`}>{children}</td>;
}
