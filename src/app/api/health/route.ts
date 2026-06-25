import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Lightweight, read-only health check. Runs `SELECT 1` against Supabase so it
// can double as a keep-alive target (e.g. for uptime monitors) and a quick
// "is the database awake?" probe. It never writes, so it can't affect data.
// Not cached — always hits the DB.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    await db.request().query("select 1");
    return NextResponse.json({ ok: true, db: "up", checkedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { ok: false, db: "down", error: message, checkedAt: new Date().toISOString() },
      { status: 503 }
    );
  }
}
