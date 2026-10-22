"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Database, RefreshCw, CheckCircle2, XCircle, Clock, CalendarClock } from "lucide-react";

type HealthState = {
  ok: boolean;
  db: "up" | "down";
  checkedAt: string;
  error?: string;
  latencyMs: number;
};

const card =
  "bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5";

export default function HealthPage() {
  const [state, setState] = useState<HealthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    setLoading(true);
    const started = performance.now();
    try {
      // Cache-busting param so we always hit the DB, never a cached response.
      const res = await fetch(`/api/health?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      setState({
        ok: !!data.ok,
        db: data.db === "up" ? "up" : "down",
        checkedAt: data.checkedAt || new Date().toISOString(),
        error: data.error,
        latencyMs: Math.round(performance.now() - started),
      });
    } catch (err) {
      setState({
        ok: false,
        db: "down",
        checkedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : "Request failed",
        latencyMs: Math.round(performance.now() - started),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (auto) timer.current = setInterval(check, 30_000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [auto, check]);

  const up = state?.db === "up";

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">System Health</h1>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-primary" />
            Auto-refresh (30s)
          </label>
          <button
            onClick={check}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-white text-sm font-semibold px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Check now
          </button>
        </div>
      </div>

      {/* Database status */}
      <div className={`${card} mb-5`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-gray-400" />
            <div>
              <p className="font-semibold">Supabase database</p>
              <p className="text-sm text-gray-400">Live <code className="text-xs">SELECT 1</code> against the production DB</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
              loading && !state
                ? "bg-gray-500/15 text-gray-400"
                : up
                ? "bg-green-500/15 text-green-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {loading && !state ? (
              <>Checking…</>
            ) : up ? (
              <><CheckCircle2 className="w-4 h-4" /> Online</>
            ) : (
              <><XCircle className="w-4 h-4" /> Offline</>
            )}
          </span>
        </div>

        {state && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Response time</p>
              <p className="font-semibold mt-0.5">{state.latencyMs} ms</p>
            </div>
            <div>
              <p className="text-gray-500 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> Last checked</p>
              <p className="font-semibold mt-0.5">{new Date(state.checkedAt).toLocaleString()}</p>
            </div>
          </div>
        )}

        {state && !up && state.error && (
          <p className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300 break-words">
            {state.error}
          </p>
        )}
      </div>

      {/* Keep-alive info */}
      <div className={card}>
        <p className="font-semibold mb-2">Automatic keep-alive</p>
        <p className="text-sm text-gray-400 leading-relaxed">
          Supabase free-tier projects pause after <strong>7 days</strong> with no database activity. A
          GitHub Actions workflow (<code className="text-xs">.github/workflows/keepalive.yml</code>) runs a
          harmless read-only <code className="text-xs">SELECT 1</code> every <strong>Mon / Wed / Fri at 06:00 UTC</strong>,
          so the inactivity timer never reaches the limit. It never writes, so it cannot affect your data.
        </p>
        <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-sm text-amber-300 leading-relaxed">
          <strong>Needs to be verified once:</strong> the workflow only works if the GitHub repo secret{" "}
          <code className="text-xs">SUPABASE_DB_URL</code> is set (Settings → Secrets and variables → Actions),
          and if the schedule is actually running. Open the repo&apos;s <strong>Actions</strong> tab and confirm the
          &ldquo;Supabase keep-alive&rdquo; workflow has recent green runs.
        </div>
      </div>
    </div>
  );
}
