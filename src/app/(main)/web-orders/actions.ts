"use server";

import { requireAdmin } from "@/lib/adminAuth";

import { getDb, sql } from "@/lib/db";
import { updateOrderStatusCore, getOrderDetails, updateDeliveryStatus } from "../orders/actions";
import { type DeliveryStatus } from "../orders/deliveryStatus";
import { userErrorMessage } from "@/lib/userError";

const UNVERIFIED = `o.PaymentMethod = 'BankTransfer' AND o.PaymentVerified IS NOT TRUE`;

// Status tabs on the Website Orders page. "unverified" is a cross-status
// filter (bank transfers awaiting verification); the rest filter by PaymentStatus.
export type WebOrderTab = "pending" | "unverified" | "paid" | "completed" | "canceled" | "all";

function tabWhere(tab: WebOrderTab): string {
  switch (tab) {
    case "pending": return `o.PaymentStatus = 'Pending'`;
    case "unverified": return UNVERIFIED;
    case "paid": return `o.PaymentStatus = 'Paid'`;
    case "completed": return `o.PaymentStatus = 'Completed'`;
    case "canceled": return `o.PaymentStatus = 'Canceled'`;
    case "all": default: return "";
  }
}

export type WebOrderCounts = {
  all: number; pending: number; unverified: number; paid: number; completed: number; canceled: number;
};

export async function getWebOrders(opts?: {
  limit?: number;
  offset?: number;
  search?: string;
  tab?: WebOrderTab;
}): Promise<
  | { ok: true; rows: any[]; total: number; counts: WebOrderCounts }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const search = (opts?.search ?? "").trim();
    const tab: WebOrderTab = opts?.tab ?? "pending";
    const pool = await getDb();

    const filters = [`o.Source = 'web'`];
    if (search) {
      filters.push(`(o.Customer ILIKE @Like OR o.CustomerPhone ILIKE @Like OR CAST(o.Id AS text) ILIKE @Like)`);
    }
    const searchWhere = "WHERE " + filters.join(" AND ");
    const extra = tabWhere(tab);
    const listWhere = extra ? `${searchWhere} AND (${extra})` : searchWhere;
    const like = `%${search}%`;

    const listReq = pool.request().input("Limit", sql.Int, limit).input("Offset", sql.Int, offset);
    if (search) listReq.input("Like", sql.NVarChar(200), like);
    const res = await listReq.query(`
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
      ${listWhere}
      ORDER BY o.OrderDate DESC
      LIMIT @Limit OFFSET @Offset
    `);

    // Tab counts respect the search but not the active tab itself.
    const countReq = pool.request();
    if (search) countReq.input("Like", sql.NVarChar(200), like);
    const counts = await countReq.query(`
      SELECT COUNT(*)::int AS "All",
             COUNT(*) FILTER (WHERE o.PaymentStatus = 'Pending')::int   AS "Pending",
             COUNT(*) FILTER (WHERE ${UNVERIFIED})::int                 AS "Unverified",
             COUNT(*) FILTER (WHERE o.PaymentStatus = 'Paid')::int      AS "Paid",
             COUNT(*) FILTER (WHERE o.PaymentStatus = 'Completed')::int AS "Completed",
             COUNT(*) FILTER (WHERE o.PaymentStatus = 'Canceled')::int  AS "Canceled"
      FROM Orders o
      ${searchWhere}
    `);
    const c = counts.recordset[0] ?? {};
    const countsOut: WebOrderCounts = {
      all: Number(c.All ?? 0),
      pending: Number(c.Pending ?? 0),
      unverified: Number(c.Unverified ?? 0),
      paid: Number(c.Paid ?? 0),
      completed: Number(c.Completed ?? 0),
      canceled: Number(c.Canceled ?? 0),
    };

    return {
      ok: true,
      rows: res.recordset,
      total: countsOut[tab],
      counts: countsOut,
    };
  } catch (err) {
    // Prod strips *thrown* Error messages (incl. UserFacingError) down to the generic
    // "Server Components render" digest — that is what masked this failure for days. The
    // only way to get the real reason to the client is to RETURN it as data (the pattern
    // documented in src/lib/userError.ts). Also log it so it lands in Vercel runtime logs.
    console.error("[getWebOrders] failed:", err);
    const e = err as { code?: string; message?: string };
    const detail = e?.code ? `${e.code} ${e.message ?? ""}`.trim() : e?.message ?? String(err);
    return { ok: false, error: `Website orders failed to load: ${detail}` };
  }
}

// Mark a (bank-transfer) payment as verified and move the order to Paid,
// which also creates the Sales rows via the shared order-status logic.
export async function verifyWebPayment(
  orderId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const pool = await getDb();
  try {
    await pool
      .request()
      .input("Id", sql.UniqueIdentifier, orderId)
      .query(`UPDATE Orders SET PaymentVerified = true WHERE Id=@Id`);
    await updateOrderStatusCore(orderId, "Paid");
    return { ok: true };
  } catch (err) {
    const msg = userErrorMessage(err);
    if (msg) return { ok: false, error: msg };
    throw err;
  }
}

export async function setWebOrderStatus(
  orderId: string,
  status: "Pending" | "Paid" | "Partial" | "Completed" | "Canceled"
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    await updateOrderStatusCore(orderId, status);
    return { ok: true };
  } catch (err) {
    const msg = userErrorMessage(err);
    if (msg) return { ok: false, error: msg };
    throw err;
  }
}

export async function setWebDeliveryStatus(
  orderId: string,
  status: DeliveryStatus
): Promise<{ ok: true } | { ok: false; error: string }> {
  // updateDeliveryStatus already enforces admin + validates the status.
  return updateDeliveryStatus(orderId, status);
}

export async function getWebOrderDetails(orderId: string) {
  await requireAdmin();
  return getOrderDetails(orderId);
}

// Lightweight count of pending website orders — used by the sidebar to show a
// red dot on the "Website Orders" nav item. Returns 0 on any error so a hiccup
// never breaks the nav.
export async function getPendingWebOrderCount(): Promise<number> {
  try {
    await requireAdmin();
    const pool = await getDb();
    const r = await pool.request().query(
      `SELECT COUNT(*)::int AS "Count" FROM Orders o WHERE o.Source = 'web' AND o.PaymentStatus = 'Pending'`
    );
    return Number(r.recordset[0]?.Count ?? 0);
  } catch {
    return 0;
  }
}
