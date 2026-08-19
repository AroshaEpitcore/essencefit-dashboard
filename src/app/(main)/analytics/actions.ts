"use server";

import { requireAdmin } from "@/lib/adminAuth";
import { getDb, sql } from "@/lib/db";

/* Website visitor analytics, read from page_views (populated by /api/track).
   All aliases are quoted so Postgres returns exact-case keys — no columnCase
   entries needed. Async-only exports (this is a "use server" module).

   Ranges are resolved in the STORE's timezone (Asia/Colombo) so "Today" /
   "Yesterday" match the owner's actual day, not UTC. */

const TZ = "Asia/Colombo";
const RANGES = ["today", "yesterday", "7d", "30d", "90d"] as const;
export type AnalyticsRange = (typeof RANGES)[number];

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);

export async function getWebAnalytics(range: string = "7d") {
  await requireAdmin();
  const r: AnalyticsRange = (RANGES as readonly string[]).includes(range) ? (range as AnalyticsRange) : "7d";
  const pool = await getDb();

  // Resolve the window (in Colombo time) once, then reuse the date bounds.
  const boundsRes = await pool
    .request()
    .input("Range", sql.NVarChar(16), r)
    .query(`
      WITH t AS (SELECT (now() AT TIME ZONE '${TZ}')::date AS today)
      SELECT
        to_char(f, 'YYYY-MM-DD')            AS "From",
        to_char(l, 'YYYY-MM-DD')            AS "To",
        to_char(f - (l - f + 1), 'YYYY-MM-DD') AS "PrevFrom",
        to_char(f - 1, 'YYYY-MM-DD')        AS "PrevTo",
        (l - f + 1)                         AS "SpanDays"
      FROM (
        SELECT
          CASE @Range
            WHEN 'today' THEN today WHEN 'yesterday' THEN today - 1
            WHEN '7d' THEN today - 6 WHEN '30d' THEN today - 29 WHEN '90d' THEN today - 89
            ELSE today - 6 END AS f,
          CASE @Range
            WHEN 'today' THEN today WHEN 'yesterday' THEN today - 1
            ELSE today END AS l
        FROM t
      ) x
    `);
  const b = (boundsRes.recordset[0] as Row) || {};
  const from = String(b.From);
  const to = String(b.To);
  const prevFrom = String(b.PrevFrom);
  const prevTo = String(b.PrevTo);
  const spanDays = num(b.SpanDays);
  const hourly = spanDays <= 1;

  // Local-time day of a row, reused across the window filters.
  const localDate = `(createdat AT TIME ZONE '${TZ}')::date`;
  const inWindow = `${localDate} BETWEEN @From::date AND @To::date`;

  const mkReq = () =>
    pool
      .request()
      .input("From", sql.NVarChar(10), from)
      .input("To", sql.NVarChar(10), to);

  const totalsQ = pool
    .request()
    .input("From", sql.NVarChar(10), from)
    .input("To", sql.NVarChar(10), to)
    .input("PrevFrom", sql.NVarChar(10), prevFrom)
    .input("PrevTo", sql.NVarChar(10), prevTo)
    .query(`
      SELECT
        (SELECT count(*) FROM page_views WHERE ${inWindow}) AS "Visits",
        (SELECT count(DISTINCT visitorid) FROM page_views WHERE ${inWindow}) AS "Uniques",
        (SELECT count(*) FROM page_views
           WHERE ${localDate} BETWEEN @PrevFrom::date AND @PrevTo::date) AS "PrevVisits",
        (SELECT count(DISTINCT visitorid) FROM page_views
           WHERE ${localDate} BETWEEN @PrevFrom::date AND @PrevTo::date) AS "PrevUniques"
    `);

  const seriesQ = hourly
    ? mkReq().query(`
        SELECT to_char(g, 'HH24:00') AS "Label",
               COALESCE(v.visits, 0) AS "Visits", COALESCE(v.uniques, 0) AS "Uniques"
        FROM generate_series(@From::date::timestamp, @From::date::timestamp + interval '23 hours', interval '1 hour') g
        LEFT JOIN (
          SELECT date_trunc('hour', createdat AT TIME ZONE '${TZ}') AS h,
                 count(*) AS visits, count(DISTINCT visitorid) AS uniques
          FROM page_views
          WHERE ${localDate} = @From::date
          GROUP BY 1
        ) v ON v.h = g
        ORDER BY g
      `)
    : mkReq().query(`
        SELECT to_char(g, 'MM-DD') AS "Label",
               COALESCE(v.visits, 0) AS "Visits", COALESCE(v.uniques, 0) AS "Uniques"
        FROM generate_series(@From::date, @To::date, interval '1 day') g
        LEFT JOIN (
          SELECT ${localDate} AS d, count(*) AS visits, count(DISTINCT visitorid) AS uniques
          FROM page_views
          WHERE ${inWindow}
          GROUP BY 1
        ) v ON v.d = g::date
        ORDER BY g
      `);

  const topPagesQ = mkReq().query(`
    SELECT path AS "Path", count(*) AS "Views", count(DISTINCT visitorid) AS "Visitors"
    FROM page_views WHERE ${inWindow}
    GROUP BY path ORDER BY count(*) DESC LIMIT 12
  `);
  const sourcesQ = mkReq().query(`
    SELECT COALESCE(NULLIF(source, ''), 'direct') AS "Source", count(*) AS "Views"
    FROM page_views WHERE ${inWindow}
    GROUP BY 1 ORDER BY count(*) DESC LIMIT 8
  `);
  const devicesQ = mkReq().query(`
    SELECT COALESCE(NULLIF(device, ''), 'unknown') AS "Device", count(*) AS "Views"
    FROM page_views WHERE ${inWindow}
    GROUP BY 1 ORDER BY count(*) DESC
  `);
  const countriesQ = mkReq().query(`
    SELECT country AS "Country", count(*) AS "Views"
    FROM page_views WHERE ${inWindow} AND country IS NOT NULL AND country <> ''
    GROUP BY country ORDER BY count(*) DESC LIMIT 8
  `);
  const citiesQ = mkReq().query(`
    SELECT city AS "City", COALESCE(country, '') AS "Country", count(*) AS "Views"
    FROM page_views WHERE ${inWindow} AND city IS NOT NULL AND city <> ''
    GROUP BY city, country ORDER BY count(*) DESC LIMIT 8
  `);

  const [totals, series, topPages, sources, devices, countries, cities] = await Promise.all([
    totalsQ, seriesQ, topPagesQ, sourcesQ, devicesQ, countriesQ, citiesQ,
  ]);

  const tt = (totals.recordset[0] as Row) || {};
  return {
    range: r,
    spanDays,
    hourly,
    totals: {
      visits: num(tt.Visits),
      uniques: num(tt.Uniques),
      prevVisits: num(tt.PrevVisits),
      prevUniques: num(tt.PrevUniques),
    },
    series: (series.recordset as Row[]).map((x) => ({
      label: String(x.Label),
      visits: num(x.Visits),
      uniques: num(x.Uniques),
    })),
    topPages: (topPages.recordset as Row[]).map((x) => ({
      path: String(x.Path),
      views: num(x.Views),
      visitors: num(x.Visitors),
    })),
    sources: (sources.recordset as Row[]).map((x) => ({ source: String(x.Source), views: num(x.Views) })),
    devices: (devices.recordset as Row[]).map((x) => ({ device: String(x.Device), views: num(x.Views) })),
    countries: (countries.recordset as Row[]).map((x) => ({ country: String(x.Country), views: num(x.Views) })),
    cities: (cities.recordset as Row[]).map((x) => ({ city: String(x.City), country: String(x.Country), views: num(x.Views) })),
  };
}
