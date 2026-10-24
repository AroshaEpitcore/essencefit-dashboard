"use client";

import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { getCategories, getProducts, getChannels, runItemProfit, getOrderAdjustments, getPrintJobTotals } from "./actions";
import type { ItemProfitFilters, ItemProfitRow, OrderAdjustments, PrintJobTotals } from "./types";
import {
  Coins,
  Filter,
  RefreshCcw,
  Search,
  Download,
  TrendingUp,
  Layers,
  ArrowUpDown,
  CalendarDays,
} from "lucide-react";

type Option = { Id: string; Name: string };

type Filters = {
  category: string;
  product: string;
  channel: string;
  from: string;
  to: string;
};

const EMPTY_FILTERS: Filters = { category: "", product: "", channel: "", from: "", to: "" };

type GroupMode = "variant" | "product";
type SortKey = "profit" | "revenue" | "cost" | "qty" | "margin";
type SortDir = "asc" | "desc";

type RangeKey = "today" | "yesterday" | "thisWeek" | "thisMonth" | "lastMonth" | "all";
const RANGE_PRESETS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "thisWeek", label: "This Week" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "all", label: "All Time" },
];

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local-time from/to (inclusive) for a named range. "" means unbounded. */
function rangeFor(key: RangeKey): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (key) {
    case "today":
      return { from: ymd(today), to: ymd(today) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: ymd(y), to: ymd(y) };
    }
    case "thisWeek": {
      const d = new Date(today);
      const dow = (d.getDay() + 6) % 7; // Monday = 0
      d.setDate(d.getDate() - dow);
      return { from: ymd(d), to: ymd(today) };
    }
    case "thisMonth":
      return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(today) };
    case "lastMonth":
      return {
        from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case "all":
    default:
      return { from: "", to: "" };
  }
}

/** A display row after grouping (variant-level or rolled up to product). */
type Line = {
  category: string;
  product: string;
  variant: string; // "" when grouped by product
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number; // profit / revenue, as a fraction
};

function money(n: unknown) {
  const v = Number(n || 0);
  return `Rs ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function num(n: unknown) {
  return Number(n || 0).toLocaleString();
}
function pct(frac: number) {
  if (!isFinite(frac)) return "—";
  return `${(frac * 100).toFixed(1)}%`;
}
function variantLabel(r: ItemProfitRow) {
  const parts = [r.Size, r.Color].filter((x) => x && x.trim());
  return parts.join(" / ") || "—";
}

export default function ItemProfitPage() {
  const [categories, setCategories] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [channels, setChannels] = useState<string[]>([]);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [activeRange, setActiveRange] = useState<RangeKey | null>(null);
  const [rows, setRows] = useState<ItemProfitRow[] | null>(null);
  // Order-level adjustments (business-wide) + whether the generated view was
  // unfiltered, so Net Profit only shows when the numbers can actually tie out.
  const [adjust, setAdjust] = useState<OrderAdjustments | null>(null);
  const [adjustApplies, setAdjustApplies] = useState(false);
  // Real print-job charge/cost (view-only) for the PrintJob channel card.
  const [pjTotals, setPjTotals] = useState<PrintJobTotals | null>(null);

  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  // View controls
  const [groupMode, setGroupMode] = useState<GroupMode>("variant");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("profit");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Load filter dropdowns once, then auto-load This Month so the tiles populate
  // without a manual click.
  useEffect(() => {
    (async () => {
      try {
        const [c, p, ch] = await Promise.all([getCategories(), getProducts(), getChannels()]);
        setCategories(c);
        setProducts(p);
        setChannels(ch);
      } catch (e) {
        toast.error((e as Error)?.message || "Failed to load filters");
      }
      const { from, to } = rangeFor("thisMonth");
      const next = { ...EMPTY_FILTERS, from, to };
      setFilters(next);
      setActiveRange("thisMonth");
      generate(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cascade products when category changes.
  useEffect(() => {
    (async () => {
      try {
        setFilters((f) => ({ ...f, product: "" }));
        setProducts(await getProducts(filters.category || undefined));
      } catch (e) {
        toast.error((e as Error)?.message || "Failed to load products");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category]);

  async function generate(f: Filters = filters) {
    setLoading(true);
    try {
      const payload: ItemProfitFilters = {
        category: f.category || undefined,
        product: f.product || undefined,
        channel: f.channel || undefined,
        from: f.from || undefined,
        to: f.to || undefined,
      };
      const unfiltered = !payload.category && !payload.product && !payload.channel;
      const [data, adj, pj] = await Promise.all([
        runItemProfit(payload),
        unfiltered ? getOrderAdjustments({ from: payload.from, to: payload.to }) : Promise.resolve(null),
        getPrintJobTotals({ from: payload.from, to: payload.to }),
      ]);
      setRows(data);
      setAdjust(adj);
      setAdjustApplies(unfiltered);
      setPjTotals(pj);
      setGeneratedAt(new Date().toLocaleString());
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to run report");
    } finally {
      setLoading(false);
    }
  }

  // Apply a named date range (keeps category/product/channel) and reload.
  function applyPreset(key: RangeKey) {
    const { from, to } = rangeFor(key);
    const next = { ...filters, from, to };
    setFilters(next);
    setActiveRange(key);
    generate(next);
  }

  // Group + filter + sort the raw rows into display lines.
  const lines = useMemo<Line[]>(() => {
    if (!rows) return [];
    const map = new Map<string, Line>();
    for (const r of rows) {
      const variant = groupMode === "variant" ? variantLabel(r) : "";
      const key = groupMode === "variant" ? `${r.Category}|${r.Product}|${variant}` : `${r.Category}|${r.Product}`;
      const cur =
        map.get(key) ||
        { category: r.Category, product: r.Product, variant, qty: 0, revenue: 0, cost: 0, profit: 0, margin: 0 };
      cur.qty += Number(r.Qty || 0);
      cur.revenue += Number(r.Revenue || 0);
      cur.cost += Number(r.Cost || 0);
      cur.profit += Number(r.Profit || 0);
      map.set(key, cur);
    }
    let out = Array.from(map.values()).map((l) => ({
      ...l,
      margin: l.revenue ? l.profit / l.revenue : 0,
    }));

    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (l) =>
          l.product.toLowerCase().includes(q) ||
          l.category.toLowerCase().includes(q) ||
          l.variant.toLowerCase().includes(q)
      );
    }
    return out;
  }, [rows, groupMode, search]);

  // Per-category summary.
  const categorySummary = useMemo(() => {
    const map = new Map<string, { category: string; qty: number; revenue: number; cost: number; profit: number }>();
    for (const l of lines) {
      const cur = map.get(l.category) || { category: l.category, qty: 0, revenue: 0, cost: 0, profit: 0 };
      cur.qty += l.qty;
      cur.revenue += l.revenue;
      cur.cost += l.cost;
      cur.profit += l.profit;
      map.set(l.category, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [lines]);

  // Per-channel summary (DTF, cash/order, PrintJob, …) from the raw rows —
  // ignores the text search so period totals stay stable.
  const channelSummary = useMemo(() => {
    if (!rows) return [];
    const map = new Map<string, { channel: string; qty: number; revenue: number; cost: number; profit: number }>();
    for (const r of rows) {
      const ch = r.PaymentMethod || "Other";
      const cur = map.get(ch) || { channel: ch, qty: 0, revenue: 0, cost: 0, profit: 0 };
      cur.qty += Number(r.Qty || 0);
      cur.revenue += Number(r.Revenue || 0);
      cur.cost += Number(r.Cost || 0);
      cur.profit += Number(r.Profit || 0);
      map.set(ch, cur);
    }
    const out = Array.from(map.values());
    // The PrintJob sale row carries only profit (so totals count just profit).
    // For the card VIEW, swap in the real charge/cost from the printjobs table.
    if (pjTotals) {
      const pj = out.find((c) => c.channel === "PrintJob");
      if (pj) {
        pj.revenue = Number(pjTotals.Revenue || 0);
        pj.cost = Number(pjTotals.Cost || 0);
        pj.profit = Number(pjTotals.Profit || 0);
        pj.qty = Number(pjTotals.Qty || 0);
      }
    }
    return out.sort((a, b) => b.revenue - a.revenue);
  }, [rows, pjTotals]);

  // Grand totals.
  const totals = useMemo(() => {
    const t = lines.reduce(
      (a, l) => {
        a.qty += l.qty;
        a.revenue += l.revenue;
        a.cost += l.cost;
        a.profit += l.profit;
        return a;
      },
      { qty: 0, revenue: 0, cost: 0, profit: 0 }
    );
    return { ...t, items: lines.length, margin: t.revenue ? t.profit / t.revenue : 0 };
  }, [lines]);

  // Net profit = gross item profit − order-level discounts/free delivery
  // + delivery fees collected. Only meaningful business-wide (unfiltered), and
  // only when the whole dataset is shown (no text search excluding rows).
  const net = useMemo(() => {
    if (!adjust || !adjustApplies || search.trim()) return null;
    const discount = Number(adjust.Discount || 0);
    const deliveryFee = Number(adjust.DeliveryFee || 0);
    const profit = totals.profit - discount + deliveryFee;
    return { discount, deliveryFee, profit };
  }, [adjust, adjustApplies, search, totals.profit]);

  // Lines grouped by category and sorted within each group — the detail table.
  const grouped = useMemo(() => {
    const sortVal = (l: Line) =>
      sortKey === "profit" ? l.profit
      : sortKey === "revenue" ? l.revenue
      : sortKey === "cost" ? l.cost
      : sortKey === "qty" ? l.qty
      : l.margin;
    const dir = sortDir === "asc" ? 1 : -1;

    const byCat = new Map<string, Line[]>();
    for (const l of lines) {
      const arr = byCat.get(l.category) || [];
      arr.push(l);
      byCat.set(l.category, arr);
    }
    // Category order follows revenue (highest first); lines sorted by chosen key.
    const catOrder = categorySummary.map((c) => c.category);
    return catOrder.map((cat) => {
      const items = (byCat.get(cat) || []).slice().sort((a, b) => (sortVal(a) - sortVal(b)) * dir);
      const sub = items.reduce(
        (a, l) => {
          a.qty += l.qty;
          a.revenue += l.revenue;
          a.cost += l.cost;
          a.profit += l.profit;
          return a;
        },
        { qty: 0, revenue: 0, cost: 0, profit: 0 }
      );
      return { category: cat, items, sub: { ...sub, margin: sub.revenue ? sub.profit / sub.revenue : 0 } };
    });
  }, [lines, categorySummary, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  function exportCsv() {
    if (!lines.length) {
      toast.error("Nothing to export");
      return;
    }
    const header = ["Category", "Product", groupMode === "variant" ? "Variant" : "", "Qty", "Revenue", "Cost", "Profit", "Margin%", showNet ? "NetProfit(est)" : ""]
      .filter(Boolean)
      .join(",");
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const body = grouped.flatMap((g) =>
      g.items.map((l) =>
        [
          esc(l.category),
          esc(l.product),
          ...(groupMode === "variant" ? [esc(l.variant)] : []),
          l.qty,
          l.revenue.toFixed(2),
          l.cost.toFixed(2),
          l.profit.toFixed(2),
          (l.margin * 100).toFixed(1),
          ...(showNet ? [netOf(l.revenue, l.profit).toFixed(2)] : []),
        ].join(",")
      )
    );
    const csv = [header, ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `item-profit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const maxCatRevenue = Math.max(1, ...categorySummary.map((c) => c.revenue));

  // Per-product Net Profit (estimate): spread the period's delivery/discount
  // adjustment across rows by sales share. Only on the unfiltered full period.
  const showNet = net !== null;
  const allocRate = showNet && totals.revenue ? (net!.deliveryFee - net!.discount) / totals.revenue : 0;
  const netOf = (revenue: number, profit: number) => profit + revenue * allocRate;

  return (
    <div className="text-gray-900 dark:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-primary/20 p-3 rounded-lg">
          <Coins className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Item Profit</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Cost, profit &amp; total sales for every item — by category and product.
            {generatedAt && <> · Last generated: {generatedAt}</>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            Filters
          </h2>
          <button
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setActiveRange(null);
            }}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Reset
          </button>
        </div>

        {/* Quick date ranges — auto-loads cost & profit for the chosen period */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mr-1">
            <CalendarDays className="w-4 h-4" />
            Period:
          </span>
          {RANGE_PRESETS.map((r) => (
            <button
              key={r.key}
              onClick={() => applyPreset(r.key)}
              disabled={loading}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors disabled:opacity-60 ${
                activeRange === r.key
                  ? "bg-primary text-white border-primary"
                  : "bg-white dark:bg-gray-800/50 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <Field label="Category">
            <select
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              className="w-full input"
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.Id} value={c.Id}>{c.Name}</option>
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
                <option key={p.Id} value={p.Id}>{p.Name}</option>
              ))}
            </select>
          </Field>

          <Field label="Channel">
            <select
              value={filters.channel}
              onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}
              className="w-full input"
            >
              <option value="">All</option>
              {channels.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          <Field label="From">
            <input
              type="date"
              value={filters.from}
              onChange={(e) => {
                setFilters((f) => ({ ...f, from: e.target.value }));
                setActiveRange(null);
              }}
              className="w-full input"
            />
          </Field>

          <Field label="To">
            <input
              type="date"
              value={filters.to}
              onChange={(e) => {
                setFilters((f) => ({ ...f, to: e.target.value }));
                setActiveRange(null);
              }}
              className="w-full input"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => generate()}
            disabled={loading}
            className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg px-6 py-3 flex items-center gap-2 disabled:opacity-60 transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>

      {rows === null ? (
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium">No data yet</p>
          <p className="text-sm mt-1">Set your filters and click &quot;Generate&quot;.</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <Kpi title="Total Sales" value={money(totals.revenue)} tone="green" />
            <Kpi title="Total Cost" value={money(totals.cost)} tone="red" />
            <Kpi title="Total Profit" value={money(totals.profit)} tone={totals.profit >= 0 ? "green" : "red"} />
            <Kpi title="Margin" value={pct(totals.margin)} />
            <Kpi title="Units Sold" value={num(totals.qty)} />
            <Kpi title={groupMode === "variant" ? "Items" : "Products"} value={num(totals.items)} />
          </div>

          {/* Net profit reconciliation — ties the page's gross item profit to
              the business-wide net P&L for the same period. */}
          {net && (
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-6">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
                <Recon label="Gross item profit" value={money(totals.profit)} />
                <span className="text-gray-400">−</span>
                <Recon label="Discounts / free delivery" value={money(net.discount)} tone="red" />
                <span className="text-gray-400">+</span>
                <Recon label="Delivery fees collected" value={money(net.deliveryFee)} tone="green" />
                <span className="text-gray-400">=</span>
                <Recon label="Net profit" value={money(net.profit)} big tone={net.profit >= 0 ? "green" : "red"} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                Net profit applies order-level discounts and delivery fees (which can&apos;t be tied to a
                single item) — this matches the Reports → P&amp;L total. It shows only for the full,
                unfiltered period; adding a category, product, channel or search filter hides it since
                those adjustments can&apos;t be attributed.
              </p>
            </div>
          )}

          {/* Per-channel summary — DTF, cash/order, PrintJob … each with its
              own sales, item cost and profit. */}
          {channelSummary.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {channelSummary.map((c) => (
                <div
                  key={c.channel}
                  className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold">{c.channel}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {num(c.qty)} units
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Sales</p>
                      <p className="font-bold text-green-600 dark:text-green-400">{money(c.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Cost</p>
                      <p className="font-bold text-red-600 dark:text-red-400">{money(c.cost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Profit</p>
                      <p className={`font-bold ${c.profit < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                        {money(c.profit)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Margin {pct(c.revenue ? c.profit / c.revenue : 0)}
                    {c.channel === "PrintJob" && (
                      <> · charge &amp; cost shown for reference — only the {money(c.profit)} profit counts toward the totals</>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Per-category summary */}
          {categorySummary.length > 0 && (
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <Layers className="w-5 h-5 text-primary" />
                By Category
              </h2>
              <div className="space-y-3">
                {categorySummary.map((c) => (
                  <div key={c.category}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{c.category}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {money(c.revenue)} sales · <span className="text-green-600 dark:text-green-400">{money(c.profit)}</span> profit ·{" "}
                        {pct(c.revenue ? c.profit / c.revenue : 0)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700/50 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(c.revenue / maxCatRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {(["variant", "product"] as GroupMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setGroupMode(m)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    groupMode === m
                      ? "bg-primary text-white"
                      : "bg-white dark:bg-gray-800/50 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                  }`}
                >
                  {m === "variant" ? "By Item" : "By Product"}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product / category / variant…"
                className="w-full input pl-9"
              />
            </div>

            <button
              onClick={exportCsv}
              className="ml-auto text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Detail table */}
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            {lines.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p>No records match the current filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[640px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-700/50">
                    <tr>
                      <Th>Product</Th>
                      {groupMode === "variant" && <Th>Item</Th>}
                      <ThSort label="Qty" k="qty" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      <ThSort label="Sales" k="revenue" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      <ThSort label="Cost" k="cost" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      <ThSort label="Profit" k="profit" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      <ThSort label="Margin" k="margin" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      {showNet && <Th className="text-right">Net Profit*</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.map((g) => (
                      <GroupBlock key={g.category} g={g} groupMode={groupMode} showNet={showNet} netOf={netOf} />
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-gray-200 dark:bg-gray-700 border-t-2 border-gray-300 dark:border-gray-600">
                    <tr className="font-bold">
                      <Td>Grand Total</Td>
                      {groupMode === "variant" && <Td />}
                      <Td className="text-right">{num(totals.qty)}</Td>
                      <Td className="text-right text-green-700 dark:text-green-400">{money(totals.revenue)}</Td>
                      <Td className="text-right text-red-700 dark:text-red-400">{money(totals.cost)}</Td>
                      <Td className="text-right">{money(totals.profit)}</Td>
                      <Td className="text-right">{pct(totals.margin)}</Td>
                      {showNet && <Td className="text-right">{money(net!.profit)}</Td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          {showNet && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              *Net Profit is an estimate — the period&apos;s free delivery &amp; discounts are spread across
              products in proportion to each one&apos;s sales (they&apos;re charged per order, not per product).
              The column totals to the business-wide Net Profit above. Shown only for the full unfiltered period.
            </p>
          )}
        </>
      )}

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

function GroupBlock({
  g,
  groupMode,
  showNet,
  netOf,
}: {
  g: { category: string; items: Line[]; sub: { qty: number; revenue: number; cost: number; profit: number; margin: number } };
  groupMode: GroupMode;
  showNet: boolean;
  netOf: (revenue: number, profit: number) => number;
}) {
  const span = groupMode === "variant" ? 2 : 1;
  return (
    <>
      <tr className="bg-gray-50 dark:bg-gray-900/40 border-t border-gray-200 dark:border-gray-700">
        <td colSpan={span} className="px-4 py-2 font-semibold text-primary">{g.category}</td>
        <Td className="text-right text-gray-500 dark:text-gray-400">{num(g.sub.qty)}</Td>
        <Td className="text-right text-gray-500 dark:text-gray-400">{money(g.sub.revenue)}</Td>
        <Td className="text-right text-gray-500 dark:text-gray-400">{money(g.sub.cost)}</Td>
        <Td className="text-right text-gray-500 dark:text-gray-400">{money(g.sub.profit)}</Td>
        <Td className="text-right text-gray-500 dark:text-gray-400">{pct(g.sub.margin)}</Td>
        {showNet && <Td className="text-right text-gray-500 dark:text-gray-400">{money(netOf(g.sub.revenue, g.sub.profit))}</Td>}
      </tr>
      {g.items.map((l, i) => (
        <tr key={i} className="border-t border-gray-100 dark:border-gray-700/60 odd:bg-gray-50/40 dark:odd:bg-gray-900/10">
          <Td className="font-medium">{l.product}</Td>
          {groupMode === "variant" && <Td className="text-gray-500 dark:text-gray-400">{l.variant}</Td>}
          <Td className="text-right">{num(l.qty)}</Td>
          <Td className="text-right text-green-600 dark:text-green-400">{money(l.revenue)}</Td>
          <Td className="text-right text-red-600 dark:text-red-400">{money(l.cost)}</Td>
          <Td className={`text-right font-semibold ${l.profit < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{money(l.profit)}</Td>
          <Td className="text-right">{pct(l.margin)}</Td>
          {showNet && (
            <Td className={`text-right font-semibold ${netOf(l.revenue, l.profit) < 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
              {money(netOf(l.revenue, l.profit))}
            </Td>
          )}
        </tr>
      ))}
    </>
  );
}

function Recon({ label, value, tone, big }: { label: string; value: string; tone?: "green" | "red"; big?: boolean }) {
  const toneClass =
    tone === "green" ? "text-green-600 dark:text-green-400" : tone === "red" ? "text-red-600 dark:text-red-400" : "";
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`font-bold ${big ? "text-xl" : "text-base"} ${toneClass}`}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
      {children}
    </div>
  );
}

function Kpi({ title, value, tone }: { title: string; value: string; tone?: "green" | "red" }) {
  const toneClass =
    tone === "green" ? "text-green-600 dark:text-green-400" : tone === "red" ? "text-red-600 dark:text-red-400" : "";
  return (
    <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">{title}</p>
      <p className={`text-lg font-bold mt-1 ${toneClass}`}>{value}</p>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`p-4 text-left font-semibold text-gray-700 dark:text-gray-300 ${className}`}>{children}</th>
  );
}

function ThSort({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  const active = k === sortKey;
  return (
    <th className="p-4 text-right font-semibold text-gray-700 dark:text-gray-300">
      <button
        onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 ml-auto hover:text-primary transition-colors ${active ? "text-primary" : ""}`}
      >
        {label}
        <ArrowUpDown className="w-3 h-3" />
        {active && <span className="text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`p-4 ${className}`}>{children}</td>;
}
