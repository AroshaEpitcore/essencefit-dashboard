import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb, sql } from "@/lib/db";

/* Storefront page-view collector. Called by a client beacon (PageView.tsx) on
   every storefront navigation. Cookieless: the visitor id is a daily-rotating
   salted hash of IP+UA, so it can't be reversed to a person and resets each day
   (GDPR-friendly, like Plausible). Never throws to the client — analytics must
   never break a page load. */

export const runtime = "nodejs";

function secret(): string {
  return process.env.SESSION_SECRET || "essencefit-dev-secret-change-me";
}

// mobile | tablet | desktop from the UA string.
function deviceFrom(ua: string): string {
  const s = ua.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/.test(s)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/.test(s)) return "mobile";
  return "desktop";
}

const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|preview|monitor|headless|lighthouse|pingdom|uptime/i;

// Normalise a referrer URL to a friendly source label.
function sourceFrom(referrer: string, host: string): string {
  if (!referrer) return "direct";
  let h = "";
  try {
    h = new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return "direct";
  }
  if (!h || (host && h === host.replace(/^www\./, ""))) return "direct"; // same-site = internal
  if (/google\./.test(h)) return "google";
  if (/instagram\./.test(h)) return "instagram";
  if (/facebook\.|fb\.|fb\.me|l\.facebook/.test(h)) return "facebook";
  if (/t\.co|twitter\.|x\.com/.test(h)) return "twitter/x";
  if (/tiktok\./.test(h)) return "tiktok";
  if (/youtube\.|youtu\.be/.test(h)) return "youtube";
  if (/whatsapp|wa\.me/.test(h)) return "whatsapp";
  if (/bing\./.test(h)) return "bing";
  return h; // any other referring domain, shown as-is
}

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") || "";
    if (BOT.test(ua)) return NextResponse.json({ ok: true }); // ignore bots silently

    const body = (await req.json().catch(() => ({}))) as { path?: string; referrer?: string };
    let path = (body.path || "").trim();
    if (!path || !path.startsWith("/")) return NextResponse.json({ ok: false });
    if (path.length > 300) path = path.slice(0, 300);
    // Strip query/hash so pages aggregate cleanly.
    path = path.split("?")[0].split("#")[0] || "/";

    const referrer = (body.referrer || "").slice(0, 400);
    const host = req.headers.get("host") || "";
    const source = sourceFrom(referrer, host);
    const device = deviceFrom(ua);
    const country =
      req.headers.get("x-vercel-ip-country") ||
      req.headers.get("cf-ipcountry") ||
      null;
    // Vercel URL-encodes the city header (e.g. "San%20Francisco").
    const rawCity = req.headers.get("x-vercel-ip-city") || req.headers.get("cf-ipcity");
    let city: string | null = null;
    if (rawCity) {
      try { city = decodeURIComponent(rawCity); } catch { city = rawCity; }
      city = city.slice(0, 120) || null;
    }

    const ip =
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "0.0.0.0";
    const day = new Date().toISOString().slice(0, 10); // rotates the id daily
    const visitorid = crypto
      .createHmac("sha256", secret())
      .update(`${ip}|${ua}|${day}`)
      .digest("hex")
      .slice(0, 16);

    const pool = await getDb();
    await pool
      .request()
      .input("Path", sql.NVarChar(300), path)
      .input("Referrer", sql.NVarChar(400), referrer || null)
      .input("Source", sql.NVarChar(120), source)
      .input("VisitorId", sql.NVarChar(32), visitorid)
      .input("Device", sql.NVarChar(20), device)
      .input("Country", sql.NVarChar(4), country)
      .input("City", sql.NVarChar(120), city)
      .query(
        `INSERT INTO page_views (path, referrer, source, visitorid, device, country, city)
         VALUES (@Path, @Referrer, @Source, @VisitorId, @Device, @Country, @City)`
      );

    return NextResponse.json({ ok: true });
  } catch {
    // Swallow — tracking failures must never surface to the visitor.
    return NextResponse.json({ ok: true });
  }
}
