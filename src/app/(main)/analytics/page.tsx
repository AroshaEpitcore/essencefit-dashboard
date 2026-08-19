"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users, Eye, TrendingUp, TrendingDown, Globe2, MonitorSmartphone, FileText, Radio, Layers, Clock, MapPin,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { getWebAnalytics } from "./actions";

type Analytics = Awaited<ReturnType<typeof getWebAnalytics>>;

const RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
];
const labelFor = (key: string) => RANGES.find((r) => r.key === key)?.label ?? "Last 7 days";
const PIE = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6", "#8b5cf6"];
const nf = (n: number) => n.toLocaleString("en-US");

function delta(cur: number, prev: number): { pct: number; up: boolean } {
  if (prev <= 0) return { pct: cur > 0 ? 100 : 0, up: cur >= 0 };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { pct: Math.abs(pct), up: pct >= 0 };
}

function Stat({
  title, value, icon, sub,
}: { title: string; value: string; icon: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <div className="mt-1 text-xs">{sub}</div>}
    </div>
  );
}

function DeltaBadge({ cur, prev, note }: { cur: number; prev: number; note: string }) {
  const { pct, up } = delta(cur, prev);
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${up ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
      {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {pct}% <span className="text-gray-400 font-normal">{note}</span>
    </span>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState("today");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (key: string) => {
    setLoading(true);
    try {
      setData(await getWebAnalytics(key));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  const rangeLabel = labelFor(range);
  const prevNote = range === "today" ? "vs yesterday" : range === "yesterday" ? "vs day before" : "vs prev.";
  const empty = data && data.totals.visits === 0 && data.totals.prevVisits === 0;

  // 4th KPI: avg/day for multi-day ranges, busiest hour for a single day.
  const busiest = useMemo(() => {
    if (!data || !data.hourly) return null;
    return data.series.reduce((best, s) => (s.visits > best.visits ? s : best), { label: "—", visits: 0 });
  }, [data]);

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radio className="w-6 h-6 text-primary" /> Website Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Visitors and traffic across your storefront.</p>
        </div>
        <div className="inline-flex flex-wrap rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3.5 py-2 text-sm font-medium transition-colors border-l first:border-l-0 border-gray-200 dark:border-gray-700 ${
                range === r.key
                  ? "bg-primary text-white"
                  : "bg-white dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="py-24 text-center text-gray-400">Loading analytics…</div>
      ) : empty ? (
        <div className="py-20 text-center bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
          <Radio className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700 dark:text-gray-200">No visits in this period</p>
          <p className="text-sm text-gray-500 mt-1">Try a wider range, or give it time as people browse the storefront.</p>
        </div>
      ) : data ? (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Stat
              title={`Visits · ${rangeLabel}`} value={nf(data.totals.visits)}
              icon={<Eye className="w-5 h-5" />}
              sub={<DeltaBadge cur={data.totals.visits} prev={data.totals.prevVisits} note={prevNote} />}
            />
            <Stat
              title={`Unique visitors · ${rangeLabel}`} value={nf(data.totals.uniques)}
              icon={<Users className="w-5 h-5" />}
              sub={<DeltaBadge cur={data.totals.uniques} prev={data.totals.prevUniques} note={prevNote} />}
            />
            <Stat
              title="Pages / visitor"
              value={data.totals.uniques ? (data.totals.visits / data.totals.uniques).toFixed(1) : "0.0"}
              icon={<Layers className="w-5 h-5" />}
              sub={<span className="text-gray-400">views per unique visitor</span>}
            />
            {data.hourly ? (
              <Stat
                title="Busiest hour" value={busiest && busiest.visits > 0 ? busiest.label : "—"}
                icon={<Clock className="w-5 h-5" />}
                sub={<span className="text-gray-400">{busiest && busiest.visits > 0 ? `${nf(busiest.visits)} visits` : "no traffic yet"}</span>}
              />
            ) : (
              <Stat
                title="Avg visits / day" value={nf(Math.round(data.totals.visits / Math.max(1, data.spanDays)))}
                icon={<Radio className="w-5 h-5" />}
                sub={<span className="text-gray-400">over {data.spanDays} days</span>}
              />
            )}
          </div>

          {/* Trend chart */}
          <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700 mb-8">
            <h2 className="text-lg font-semibold mb-4">{data.hourly ? "Traffic by hour" : "Traffic over time"}</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.series} margin={{ left: -18, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="gVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gUniques" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={20} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={44} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="visits" name="Visits" stroke="#6366f1" strokeWidth={2} fill="url(#gVisits)" />
                <Area type="monotone" dataKey="uniques" name="Unique visitors" stroke="#22c55e" strokeWidth={2} fill="url(#gUniques)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top pages */}
            <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Top pages</h2>
              {data.topPages.length === 0 ? (
                <p className="text-sm text-gray-400">No data in this period.</p>
              ) : (
                <div className="space-y-1">
                  {data.topPages.map((p) => {
                    const max = data.topPages[0].views || 1;
                    return (
                      <div key={p.path} className="relative flex items-center justify-between py-1.5 px-2 rounded overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-primary/10 rounded" style={{ width: `${(p.views / max) * 100}%` }} />
                        <span className="relative text-sm truncate mr-3 font-mono text-gray-700 dark:text-gray-200">{p.path}</span>
                        <span className="relative text-sm font-semibold tabular-nums">{nf(p.views)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sources */}
            <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Globe2 className="w-5 h-5 text-primary" /> Traffic sources</h2>
              {data.sources.length === 0 ? (
                <p className="text-sm text-gray-400">No data in this period.</p>
              ) : (
                <div className="space-y-1">
                  {data.sources.map((s) => {
                    const max = data.sources[0].views || 1;
                    return (
                      <div key={s.source} className="relative flex items-center justify-between py-1.5 px-2 rounded overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-green-500/10 rounded" style={{ width: `${(s.views / max) * 100}%` }} />
                        <span className="relative text-sm capitalize mr-3 text-gray-700 dark:text-gray-200">{s.source}</span>
                        <span className="relative text-sm font-semibold tabular-nums">{nf(s.views)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Devices */}
            <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><MonitorSmartphone className="w-5 h-5 text-primary" /> Devices</h2>
              {data.devices.length === 0 ? (
                <p className="text-sm text-gray-400">No data in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data.devices} dataKey="views" nameKey="device" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {data.devices.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Countries */}
            <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Globe2 className="w-5 h-5 text-primary" /> Top countries</h2>
              {data.countries.length === 0 ? (
                <p className="text-sm text-gray-400">Country data appears once deployed (from CDN geo headers).</p>
              ) : (
                <div className="space-y-1">
                  {data.countries.map((c) => {
                    const max = data.countries[0].views || 1;
                    return (
                      <div key={c.country} className="relative flex items-center justify-between py-1.5 px-2 rounded overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-indigo-500/10 rounded" style={{ width: `${(c.views / max) * 100}%` }} />
                        <span className="relative text-sm mr-3 text-gray-700 dark:text-gray-200">{c.country}</span>
                        <span className="relative text-sm font-semibold tabular-nums">{nf(c.views)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cities */}
            <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> Top cities</h2>
              {data.cities.length === 0 ? (
                <p className="text-sm text-gray-400">City data appears once deployed (from CDN geo headers).</p>
              ) : (
                <div className="space-y-1">
                  {data.cities.map((c) => {
                    const max = data.cities[0].views || 1;
                    return (
                      <div key={`${c.city}-${c.country}`} className="relative flex items-center justify-between py-1.5 px-2 rounded overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-teal-500/10 rounded" style={{ width: `${(c.views / max) * 100}%` }} />
                        <span className="relative text-sm mr-3 text-gray-700 dark:text-gray-200">
                          {c.city}{c.country ? <span className="text-gray-400">, {c.country}</span> : null}
                        </span>
                        <span className="relative text-sm font-semibold tabular-nums">{nf(c.views)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
