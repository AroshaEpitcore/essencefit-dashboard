"use server";

import { getDb } from "@/lib/db";
import sql, { UniqueIdentifier, NVarChar, Int } from "mssql";

export type OrderLog = {
  Id: string;
  OrderId: string;
  OldStatus: string | null;
  NewStatus: string;
  ChangedAt: Date;
  ChangedBy: string | null;
  Customer: string | null;
  CustomerPhone: string | null;
  OrderTotal: number;
};

/**
 * Get order status change logs with filters
 */
export async function getOrderLogs(options: {
  limit?: number;
  offset?: number;
  fromDate?: string;
  toDate?: string;
  status?: string;
  orderId?: string;
}) {
  const pool = await getDb();
  const { limit = 100, offset = 0, fromDate, toDate, status, orderId } = options;

  const req = pool.request();
  req.input("limit", Int, limit);
  req.input("offset", Int, offset);

  let whereClause = "WHERE 1=1";

  if (fromDate) {
    req.input("fromDate", sql.DateTime2, new Date(fromDate));
    whereClause += " AND l.ChangedAt >= @fromDate";
  }

  if (toDate) {
    const toDateEnd = new Date(toDate);
    toDateEnd.setHours(23, 59, 59, 999);
    req.input("toDate", sql.DateTime2, toDateEnd);
    whereClause += " AND l.ChangedAt <= @toDate";
  }

  if (status) {
    req.input("status", NVarChar(50), status);
    whereClause += " AND l.NewStatus = @status";
  }

  if (orderId) {
    req.input("orderId", NVarChar(100), `%${orderId}%`);
    whereClause += " AND CAST(l.OrderId AS NVARCHAR(100)) LIKE @orderId";
  }

  const result = await req.query(`
    SELECT
      l.Id,
      l.OrderId,
      l.OldStatus,
      l.NewStatus,
      l.ChangedAt,
      l.ChangedBy,
      o.Customer,
      o.CustomerPhone,
      o.Total AS OrderTotal
    FROM OrderStatusLogs l
    LEFT JOIN Orders o ON o.Id = l.OrderId
    ${whereClause}
    ORDER BY l.ChangedAt DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  // Get total count for pagination
  const countResult = await pool.request().query(`
    SELECT COUNT(*) AS Total FROM OrderStatusLogs l ${whereClause.replace(/@\w+/g, 'NULL')}
  `);

  return {
    logs: result.recordset as OrderLog[],
    total: countResult.recordset[0]?.Total || 0,
  };
}

/**
 * Get summary stats for order logs
 */
export async function getOrderLogStats(fromDate?: string, toDate?: string) {
  const pool = await getDb();
  const req = pool.request();

  let whereClause = "WHERE 1=1";

  if (fromDate) {
    req.input("fromDate", sql.DateTime2, new Date(fromDate));
    whereClause += " AND ChangedAt >= @fromDate";
  }

  if (toDate) {
    const toDateEnd = new Date(toDate);
    toDateEnd.setHours(23, 59, 59, 999);
    req.input("toDate", sql.DateTime2, toDateEnd);
    whereClause += " AND ChangedAt <= @toDate";
  }

  const result = await req.query(`
    SELECT
      NewStatus,
      COUNT(*) AS Count
    FROM OrderStatusLogs
    ${whereClause}
    GROUP BY NewStatus
    ORDER BY COUNT(*) DESC
  `);

  return result.recordset as { NewStatus: string; Count: number }[];
}

/**
 * Log an order status change (called from orders actions)
 */
export async function logOrderStatusChange(
  tx: sql.Transaction,
  orderId: string,
  oldStatus: string | null,
  newStatus: string,
  changedBy?: string | null
) {
  await new sql.Request(tx)
    .input("Id", UniqueIdentifier, crypto.randomUUID())
    .input("OrderId", UniqueIdentifier, orderId)
    .input("OldStatus", NVarChar(50), oldStatus)
    .input("NewStatus", NVarChar(50), newStatus)
    .input("ChangedAt", sql.DateTime2, new Date())
    .input("ChangedBy", NVarChar(100), changedBy || null)
    .query(`
      INSERT INTO OrderStatusLogs (Id, OrderId, OldStatus, NewStatus, ChangedAt, ChangedBy)
      VALUES (@Id, @OrderId, @OldStatus, @NewStatus, @ChangedAt, @ChangedBy)
    `);
}
