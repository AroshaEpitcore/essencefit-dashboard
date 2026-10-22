"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Database, RefreshCw, CheckCircle2, XCircle, Clock, CalendarClock, KeyRound, ShieldAlert, Save, Github, ExternalLink } from "lucide-react";

// Production Supabase project facts (confirmed Oct 2026). Kept here as an
// always-available runbook so whoever is on call can find and access the DB.
const PROJECT = {
  name: "Essencefit-live-site",
  ref: "rmyiozcgmpzcrpegnyhl",
  url: "https://rmyiozcgmpzcrpegnyhl.supabase.co",
  dashboard: "https://supabase.com/dashboard/project/rmyiozcgmpzcrpegnyhl",
  region: "ap-northeast-2 (Seoul)",
  compute: "nano (Free plan)",
};

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

      {/* Database project identity */}
      <div className={`${card} mt-5`}>
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-5 h-5 text-gray-400" />
          <p className="font-semibold">Production database project</p>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex justify-between gap-4 border-b border-gray-100 dark:border-gray-700/50 py-1">
            <dt className="text-gray-500">Project name</dt>
            <dd className="font-medium text-right">{PROJECT.name}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-gray-100 dark:border-gray-700/50 py-1">
            <dt className="text-gray-500">Reference ID</dt>
            <dd className="font-mono text-xs text-right break-all">{PROJECT.ref}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-gray-100 dark:border-gray-700/50 py-1">
            <dt className="text-gray-500">Region</dt>
            <dd className="font-medium text-right">{PROJECT.region}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-gray-100 dark:border-gray-700/50 py-1">
            <dt className="text-gray-500">Compute</dt>
            <dd className="font-medium text-right">{PROJECT.compute}</dd>
          </div>
        </dl>
        <a
          href={PROJECT.dashboard}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary text-white text-sm font-semibold px-4 py-2 hover:bg-primary/90 transition-colors"
        >
          <ExternalLink className="w-4 h-4" /> Open in Supabase dashboard
        </a>
      </div>

      {/* Which account + how to log in */}
      <div className={`${card} mt-5`}>
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="w-5 h-5 text-gray-400" />
          <p className="font-semibold">Which account owns it &amp; how to log in</p>
        </div>

        <dl className="mb-3 text-sm divide-y divide-gray-100 dark:divide-gray-700/50">
          <div className="flex items-center justify-between gap-4 py-1.5">
            <dt className="text-gray-500">Owner account (use this)</dt>
            <dd className="font-medium text-right">
              <span className="font-mono text-xs">mgaravishan@gmail.com</span>
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-500/15 text-green-400 px-2 py-0.5 text-xs font-semibold"><Github className="w-3 h-3" /> GitHub login</span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-1.5">
            <dt className="text-gray-500">Office account (NOT the owner)</dt>
            <dd className="font-medium text-right">
              <span className="font-mono text-xs">epitcore@gmail.com</span>
              <span className="ml-2 inline-flex items-center rounded-full bg-gray-500/15 text-gray-400 px-2 py-0.5 text-xs font-semibold">wrong project</span>
            </dd>
          </div>
        </dl>

        <p className="text-sm text-gray-400 leading-relaxed">
          This project lives in the <strong>personal</strong> Supabase account, which signs in with{" "}
          <strong className="inline-flex items-center gap-1"><Github className="w-3.5 h-3.5" /> GitHub</strong>{" "}
          (the personal GitHub linked to <code className="text-xs">mgaravishan@gmail.com</code>). There is
          <strong> no Google or email/password login</strong> — GitHub is the only way in.
        </p>
        <div className="mt-3 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-sm text-blue-200 leading-relaxed">
          <p className="font-semibold mb-1">Important: not the office account</p>
          The office account <code className="text-xs">epitcore@gmail.com</code> does <strong>not</strong> own this
          database — it only holds an unused empty project (ref <code className="text-xs">uyysrjyhjhwfypxjxocy</code>,
          Tokyo). Logging in there will show the wrong project.
        </div>
        <ol className="mt-3 list-decimal pl-5 space-y-1.5 text-sm text-gray-300">
          <li>Go to <code className="text-xs">github.com</code> and sign in as the <strong>personal</strong> GitHub account (<code className="text-xs">mgaravishan@gmail.com</code>). A private/incognito window avoids the office session clashing.</li>
          <li>Go to <code className="text-xs">supabase.com/dashboard</code> and click <strong>&ldquo;Continue with GitHub&rdquo;</strong>.</li>
          <li>Open the project (button above) and confirm Reference ID = <code className="text-xs">{PROJECT.ref}</code>.</li>
        </ol>
      </div>

      {/* Action items / known advisories */}
      <div className={`${card} mt-5`}>
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-5 h-5 text-gray-400" />
          <p className="font-semibold">Known action items</p>
        </div>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 leading-relaxed">
            <p className="flex items-center gap-2 font-semibold text-red-300"><Save className="w-4 h-4" /> No backups configured</p>
            <p className="text-gray-300 mt-1">
              The Free/nano tier takes <strong>no automatic backups</strong>. If data is lost there is nothing to
              restore from. Set up a scheduled <code className="text-xs">pg_dump</code> (can be added to the existing
              keep-alive GitHub Action) or upgrade to Pro for daily backups + point-in-time recovery.
            </p>
          </div>

          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 leading-relaxed">
            <p className="flex items-center gap-2 font-semibold text-amber-300"><ShieldAlert className="w-4 h-4" /> 43 &ldquo;RLS disabled&rdquo; advisor warnings — low risk here</p>
            <p className="text-gray-300 mt-1">
              These flag the public <strong>Data API (PostgREST)</strong>. This app connects <strong>directly to
              Postgres</strong> (the <code className="text-xs">pg</code> driver via the connection string) using the
              privileged <code className="text-xs">postgres</code> role — it never uses the REST API and no anon key is
              shipped anywhere. Cleanest fix: <strong>disable the Data API</strong> (Project Settings → API → Data API →
              remove <code className="text-xs">public</code> from exposed schemas). This clears all 43 warnings with no
              impact on the site.
            </p>
          </div>

          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 leading-relaxed">
            <p className="flex items-center gap-2 font-semibold text-amber-300"><KeyRound className="w-4 h-4" /> Confirm the keep-alive secret</p>
            <p className="text-gray-300 mt-1">
              Pause-prevention only runs if the GitHub repo secret <code className="text-xs">SUPABASE_DB_URL</code> is set
              to the pooler connection string (Project Settings → Database → Connection string). With dashboard access
              you can now also click <strong>Restore</strong> if the project ever pauses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
