import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb, sql } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rateLimit";

/* Promo-popup analytics beacon (impression | click | dismiss). Mirrors the
   /api/track pattern but is RATE-LIMITED per visitor so it can't be spammed to
   pollute analytics or hammer the DB pooler. Cookieless + never throws. */

export const runtime = "nodejs";

const EVENTS = new Set(["impression", "click", "dismiss"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT = /bot|crawl|spider|slurp|preview|monitor|headless|lighthouse|pingdom|uptime/i;

function secret(): string {
  return process.env.SESSION_SECRET || "essencefit-dev-secret-change-me";
}

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") || "";
    if (BOT.test(ua)) return NextResponse.json({ ok: true });

    const body = (await req.json().catch(() => ({}))) as { popupId?: string; event?: string };
    const popupId = String(body.popupId || "");
    const event = String(body.event || "");
    if (!UUID.test(popupId) || !EVENTS.has(event)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const ip =
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "0.0.0.0";

    // Cap popup events per IP (plenty for real use; blocks floods).
    if (!(await consumeRateLimit(`promoevt:${ip}`, 120, 60)).allowed) {
      return NextResponse.json({ ok: true });
    }

    const day = new Date().toISOString().slice(0, 10);
    const visitorid = crypto
      .createHmac("sha256", secret())
      .update(`${ip}|${ua}|${day}`)
      .digest("hex")
      .slice(0, 16);

    const pool = await getDb();
    await pool
      .request()
      .input("PopupId", sql.UniqueIdentifier, popupId)
      .input("Event", sql.NVarChar(20), event)
      .input("VisitorId", sql.NVarChar(32), visitorid)
      .query(`INSERT INTO popup_events (popupid, event, visitorid) VALUES (@PopupId, @Event, @VisitorId)`);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
