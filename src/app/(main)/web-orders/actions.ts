"use server";

import { requireAdmin } from "@/lib/adminAuth";

import { getDb, sql } from "@/lib/db";
import { updateOrderStatusCore, getOrderDetails, updateDeliveryStatus, type DeliveryStatus } from "../orders/actions";
import { userErrorMessage } from "@/lib/userError";

const UNVERIFIED = `o.PaymentMethod = 'BankTransfer' AND o.PaymentVerified IS NOT TRUE`;

export async function getWebOrders(opts?: {
  limit?: number;
  offset?: number;
  search?: string;
  unverifiedOnly?: boolean;
}): Promise<
  | { ok: true; rows: any[]; total: number; unverifiedTotal: number }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const search = (opts?.search ?? "").trim();
    const pool = await getDb();

    const filters = [`o.Source = 'web'`];
    if (search) {
      filters.push(`(o.Customer ILIKE @Like OR o.CustomerPhone ILIKE @Like OR CAST(o.Id AS text) ILIKE @Like)`);
    }
    const searchWhere = "WHERE " + filters.join(" AND ");
    const listWhere = opts?.unverifiedOnly ? `${searchWhere} AND (${UNVERIFIED})` : searchWhere;
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
      SELECT COUNT(*)::int AS "Total",
             COUNT(*) FILTER (WHERE ${UNVERIFIED})::int AS "UnverifiedTotal"
      FROM Orders o
      ${searchWhere}
    `);

    return {
      ok: true,
      rows: res.recordset,
      total: Number(counts.recordset[0]?.Total ?? 0),
      unverifiedTotal: Number(counts.recordset[0]?.UnverifiedTotal ?? 0),
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
