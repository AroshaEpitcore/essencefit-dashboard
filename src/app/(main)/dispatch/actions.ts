"use server";

import { getDb } from "@/lib/db";
import sql, { NVarChar, UniqueIdentifier } from "mssql";

/* ---------- Create Dispatch Message ---------- */

export async function createDispatchMessage(
  orderId: string,
  waybillId: string,
  customerName: string | null,
  customerPhone: string | null
) {
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

/* ---------- Get Dispatch Messages (with lazy cleanup) ---------- */

export async function getDispatchMessages() {
  const pool = await getDb();

  // Auto-delete messages older than 7 days
  await pool.request().query(`
    DELETE FROM DispatchMessages WHERE CreatedAt < DATEADD(DAY, -7, GETDATE())
  `);

  const res = await pool.request().query(`
    SELECT Id, OrderId, WaybillId, CustomerName, CustomerPhone, CreatedAt
    FROM DispatchMessages
    ORDER BY CreatedAt DESC
  `);

  return res.recordset as {
    Id: string;
    OrderId: string;
    WaybillId: string;
    CustomerName: string | null;
    CustomerPhone: string | null;
    CreatedAt: string;
  }[];
}

/* ---------- Delete a single dispatch message ---------- */

export async function deleteDispatchMessage(id: string) {
  const pool = await getDb();
  await pool
    .request()
    .input("Id", UniqueIdentifier, id)
    .query(`DELETE FROM DispatchMessages WHERE Id=@Id`);
}
