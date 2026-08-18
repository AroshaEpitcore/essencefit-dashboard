"use server";

import { requireAdmin } from "@/lib/adminAuth";
import { getDb, sql } from "@/lib/db";

/* Website visitor analytics, read from page_views (populated by /api/track).
   All aliases are quoted so Postgres returns exact-case keys — no columnCase
   entries needed. Async-only exports (this is a "use server" module). */

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);

export async function getWebAnalytics(days = 30) {
  await requireAdmin();
  const d = [7, 30, 90].includes(days) ? days : 30;
  const pool = await getDb();

  const totalsQ = pool
    .request()
    .input("Days", sql.Int, d)
    .query(`
      SELECT
        (SELECT count(*) FROM page_views WHERE createdat >= current_date - (@Days::int - 1)) AS "Visits",
        (SELECT count(DISTINCT visitorid) FROM page_views WHERE createdat >= current_date - (@Days::int - 1)) AS "Uniques",
        (SELECT count(*) FROM page_views
           WHERE createdat >= current_date - (@Days::int * 2 - 1)
             AND createdat <  current_date - (@Days::int - 1)) AS "PrevVisits",
        (SELECT count(DISTINCT visitorid) FROM page_views
           WHERE createdat >= current_date - (@Days::int * 2 - 1)
             AND createdat <  current_date - (@Days::int - 1)) AS "PrevUniques",
        (SELECT count(*) FROM page_views WHERE createdat::date = current_date) AS "Today",
        (SELECT count(DISTINCT visitorid) FROM page_views WHERE createdat::date = current_date) AS "TodayUniques"
    `);

  const seriesQ = pool
    .request()
    .input("Days", sql.Int, d)
    .query(`
      SELECT to_char(g::date, 'YYYY-MM-DD') AS "Date",
             COALESCE(v.visits, 0)  AS "Visits",
             COALESCE(v.uniques, 0) AS "Uniques"
      FROM generate_series(current_date - (@Days::int - 1), current_date, interval '1 day') g
      LEFT JOIN (
        SELECT createdat::date AS d, count(*) AS visits, count(DISTINCT visitorid) AS uniques
        FROM page_views
        WHERE createdat >= current_date - (@Days::int - 1)
        GROUP BY createdat::date
      ) v ON v.d = g::date
      ORDER BY g
    `);

  const topPagesQ = pool
    .request()
    .input("Days", sql.Int, d)
    .query(`
      SELECT path AS "Path", count(*) AS "Views", count(DISTINCT visitorid) AS "Visitors"
      FROM page_views
      WHERE createdat >= current_date - (@Days::int - 1)
      GROUP BY path ORDER BY count(*) DESC LIMIT 12
    `);

  const sourcesQ = pool
    .request()
    .input("Days", sql.Int, d)
    .query(`
      SELECT COALESCE(NULLIF(source, ''), 'direct') AS "Source", count(*) AS "Views"
      FROM page_views
      WHERE createdat >= current_date - (@Days::int - 1)
      GROUP BY 1 ORDER BY count(*) DESC LIMIT 8
    `);

  const devicesQ = pool
    .request()
    .input("Days", sql.Int, d)
    .query(`
      SELECT COALESCE(NULLIF(device, ''), 'unknown') AS "Device", count(*) AS "Views"
      FROM page_views
      WHERE createdat >= current_date - (@Days::int - 1)
      GROUP BY 1 ORDER BY count(*) DESC
    `);

  const countriesQ = pool
    .request()
    .input("Days", sql.Int, d)
    .query(`
      SELECT country AS "Country", count(*) AS "Views"
      FROM page_views
      WHERE createdat >= current_date - (@Days::int - 1) AND country IS NOT NULL AND country <> ''
      GROUP BY country ORDER BY count(*) DESC LIMIT 8
    `);

  const [totals, series, topPages, sources, devices, countries] = await Promise.all([
    totalsQ, seriesQ, topPagesQ, sourcesQ, devicesQ, countriesQ,
  ]);

  const t = (totals.recordset[0] as Row) || {};
  return {
    days: d,
    totals: {
      visits: num(t.Visits),
      uniques: num(t.Uniques),
      prevVisits: num(t.PrevVisits),
      prevUniques: num(t.PrevUniques),
      today: num(t.Today),
      todayUniques: num(t.TodayUniques),
    },
    series: (series.recordset as Row[]).map((r) => ({
      date: String(r.Date),
      visits: num(r.Visits),
      uniques: num(r.Uniques),
    })),
    topPages: (topPages.recordset as Row[]).map((r) => ({
      path: String(r.Path),
      views: num(r.Views),
      visitors: num(r.Visitors),
    })),
    sources: (sources.recordset as Row[]).map((r) => ({ source: String(r.Source), views: num(r.Views) })),
    devices: (devices.recordset as Row[]).map((r) => ({ device: String(r.Device), views: num(r.Views) })),
    countries: (countries.recordset as Row[]).map((r) => ({ country: String(r.Country), views: num(r.Views) })),
  };
}
