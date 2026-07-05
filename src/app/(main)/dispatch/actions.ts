"use server";

import { requireAdmin } from "@/lib/adminAuth";

import { getDb } from "@/lib/db";
import sql, { NVarChar, UniqueIdentifier } from "@/lib/sqlShim";

/* ---------- Sync all pending orders (with waybill) into DispatchMessages ---------- */

export async function syncPendingToDispatch() {
  await requireAdmin();
  const pool = await getDb();

  // Insert new pending orders not yet in DispatchMessages
  const newRes = await pool.request().query(`
    SELECT o.Id, o.Customer, o.CustomerPhone, o.WaybillId
    FROM Orders o
    WHERE o.PaymentStatus = 'Pending'
      AND NOT EXISTS (
        SELECT 1 FROM DispatchMessages dm WHERE dm.OrderId = o.Id
      )
  `);

  for (const row of newRes.recordset) {
    await pool
      .request()
      .input("Id", UniqueIdentifier, crypto.randomUUID())
      .input("OrderId", UniqueIdentifier, row.Id)
      .input("WaybillId", NVarChar(100), row.WaybillId || "")
      .input("CustomerName", NVarChar(200), row.Customer || null)
      .input("CustomerPhone", NVarChar(20), row.CustomerPhone || null)
      .query(`
        INSERT INTO DispatchMessages (Id, OrderId, WaybillId, CustomerName, CustomerPhone)
        VALUES (@Id, @OrderId, @WaybillId, @CustomerName, @CustomerPhone)
      `);
  }

  // Update WaybillId in existing DispatchMessages where the order's WaybillId has been set/changed
  await pool.request().query(`
    UPDATE dm
    SET dm.WaybillId = o.WaybillId
    FROM DispatchMessages dm
    INNER JOIN Orders o ON o.Id = dm.OrderId
    WHERE COALESCE(o.WaybillId, '') <> ''
      AND COALESCE(dm.WaybillId, '') <> COALESCE(o.WaybillId, '')
  `);
}

/* ---------- Get Dispatch Messages (with order status) ---------- */

export async function getDispatchMessages() {
  await requireAdmin();
  const pool = await getDb();

  // Auto-delete messages older than 7 days
  await pool.request().query(`
    DELETE FROM DispatchMessages WHERE CreatedAt < (now() + interval '-7 days')
  `);

  const res = await pool.request().query(`
    SELECT
      dm.Id,
      dm.OrderId,
      COALESCE(NULLIF(o.WaybillId, ''), NULLIF(dm.WaybillId, '')) AS WaybillId,
      dm.CustomerName,
      dm.CustomerPhone,
      dm.CreatedAt,
      COALESCE(o.PaymentStatus, 'Unknown') AS OrderStatus
    FROM DispatchMessages dm
    LEFT JOIN Orders o ON o.Id = dm.OrderId
    ORDER BY dm.CreatedAt DESC
  `);

  return res.recordset as {
    Id: string;
    OrderId: string;
    WaybillId: string;
    CustomerName: string | null;
    CustomerPhone: string | null;
    CreatedAt: string;
    OrderStatus: string;
  }[];
}

/* ---------- Delete a single dispatch message ---------- */

export async function deleteDispatchMessage(id: string) {
  await requireAdmin();
  const pool = await getDb();
  await pool
    .request()
    .input("Id", UniqueIdentifier, id)
    .query(`DELETE FROM DispatchMessages WHERE Id=@Id`);
}

/* ---------- Create Dispatch Message ---------- */

export async function createDispatchMessage(
  orderId: string,
  waybillId: string,
  customerName: string | null,
  customerPhone: string | null
) {
  await requireAdmin();
  const pool = await getDb();
  const id = crypto.randomUUID();

  await pool
    .request()
    .input("Id", UniqueIdentifier, id)
    .input("OrderId", UniqueIdentifier, orderId)
    .input("WaybillId", NVarChar(100), waybillId)
    .input("CustomerName", NVarChar(200), customerName || null)
    .input("CustomerPhone", NVarChar(20), customerPhone || null)
    .query(`
      INSERT INTO DispatchMessages (Id, OrderId, WaybillId, CustomerName, CustomerPhone)
      VALUES (@Id, @OrderId, @WaybillId, @CustomerName, @CustomerPhone)
    `);

  return id;
}
