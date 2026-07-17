import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Lightweight, read-only health check. Runs `SELECT 1` against Supabase so it
// can double as a keep-alive target (e.g. for uptime monitors) and a quick
// "is the database awake?" probe. It never writes, so it can't affect data.
// Not cached — always hits the DB.
export const dynamic = "force-dynamic";

export async function GET() {
  const diag: Record<string, unknown> = { checkedAt: new Date().toISOString() };
  try {
    const db = await getDb();
    await db.request().query("select 1");
    diag.db = "up";

    // Which database is production actually on?
    try {
      const who = await db.request().query(
        "SELECT current_database() AS d, host(inet_server_addr()) AS h"
      );
      diag.database = who.recordset[0]?.D ?? who.recordset[0]?.d;
      diag.host = who.recordset[0]?.H ?? who.recordset[0]?.h;
    } catch (e) {
      diag.identity_error = e instanceof Error ? e.message : String(e);
    }

    // Does the delivery column / rate-limit table exist on THIS database?
    try {
      const meta = await db.request().query(
        `SELECT
           (SELECT count(*) FROM information_schema.columns WHERE table_name='orders' AND column_name='deliverystatus') AS c,
           (SELECT count(*) FROM information_schema.tables  WHERE table_name='auth_attempts') AS t`
      );
      diag.has_deliverystatus = Number(meta.recordset[0]?.C ?? meta.recordset[0]?.c) > 0;
      diag.has_auth_attempts = Number(meta.recordset[0]?.T ?? meta.recordset[0]?.t) > 0;
    } catch (e) {
      diag.meta_error = e instanceof Error ? e.message : String(e);
    }

    // Reproduce the exact failing read through the prod shim — capture real error.
    try {
      await db.request().query("SELECT o.DeliveryStatus FROM Orders o LIMIT 1");
      diag.delivery_select = "ok";
    } catch (e) {
      diag.delivery_select_error = e instanceof Error ? e.message : String(e);
    }

    // Full getWebOrders list query (exactly as the admin page runs it).
    try {
      const r = await db.request().input("Limit", 50).input("Offset", 0).query(`
        SELECT
          o.Id, o.Customer, o.CustomerPhone, o.SecondaryPhone, o.Address, o.Province, o.CustomerEmail,
          o.PaymentMethod, o.PaymentSlipUrl, o.PaymentVerified, o.PaymentStatus, o.DeliveryStatus,
          o.OrderDate, o.Notes, o.Subtotal, o.DeliveryFee, o.Total,
          (SELECT COUNT(*) FROM OrderItems oi WHERE oi.OrderId = o.Id) AS LineCount,
          EXISTS (
            SELECT 1 FROM OrderItems oi
            JOIN ProductVariants v ON v.Id = oi.VariantId
            JOIN Products p ON p.Id = v.ProductId
            WHERE oi.OrderId = o.Id AND p.PrintOnDemand = true
          ) AS HasPrintOnDemand
        FROM Orders o
        WHERE o.Source = 'web'
        ORDER BY o.OrderDate DESC
        LIMIT @Limit OFFSET @Offset
      `);
      diag.weborders_query = "ok rows=" + r.recordset.length;
    } catch (e) {
      diag.weborders_query_error = e instanceof Error ? e.message : String(e);
    }

    // fn_StockVariantId path (used by /orders, /dashboard) after the column add.
    try {
      await db.request().query(
        "SELECT o.Id, o.DeliveryStatus, (SELECT z.Qty FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(oi.VariantId)) AS s FROM Orders o JOIN OrderItems oi ON oi.OrderId=o.Id LIMIT 1"
      );
      diag.fn_stock_path = "ok";
    } catch (e) {
      diag.fn_stock_path_error = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json({ ok: true, ...diag });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ ok: false, db: "down", error: message, ...diag }, { status: 503 });
  }
}
