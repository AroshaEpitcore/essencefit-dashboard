"use server";

import { getDb } from "@/lib/db";

export type NotificationItem = {
  id: string;
  type: "low_stock" | "out_of_stock" | "stale_pending" | "recent_return";
  title: string;
  body: string;
  severity: "critical" | "warning" | "info";
};

export async function getNotifications(): Promise<NotificationItem[]> {
  const pool = await getDb();
  const items: NotificationItem[] = [];

  // 1. Out of stock (qty = 0)
  const outOfStock = await pool.request().query(`
    SELECT TOP 10
      p.Name AS Product,
      s.Name AS Size,
      c.Name AS Color
    FROM ProductVariants v
    JOIN Products p ON p.Id = v.ProductId
    LEFT JOIN Sizes s ON s.Id = v.SizeId
    LEFT JOIN Colors c ON c.Id = v.ColorId
    WHERE v.Qty = 0
    ORDER BY p.Name
  `);
  for (const row of outOfStock.recordset) {
    items.push({
      id: `oos-${row.Product}-${row.Size}-${row.Color}`,
      type: "out_of_stock",
      title: "Out of Stock",
      body: `${row.Product} · ${row.Size ?? "—"} · ${row.Color ?? "—"}`,
      severity: "critical",
    });
  }

  // 2. Low stock (qty 1–5)
  const lowStock = await pool.request().query(`
    SELECT TOP 10
      p.Name AS Product,
      s.Name AS Size,
      c.Name AS Color,
      v.Qty
    FROM ProductVariants v
    JOIN Products p ON p.Id = v.ProductId
    LEFT JOIN Sizes s ON s.Id = v.SizeId
    LEFT JOIN Colors c ON c.Id = v.ColorId
    WHERE v.Qty BETWEEN 1 AND 5
    ORDER BY v.Qty ASC
  `);
  for (const row of lowStock.recordset) {
    items.push({
      id: `low-${row.Product}-${row.Size}-${row.Color}`,
      type: "low_stock",
      title: `Low Stock — ${row.Qty} left`,
      body: `${row.Product} · ${row.Size ?? "—"} · ${row.Color ?? "—"}`,
      severity: "warning",
    });
  }

  // 3. Stale pending orders (>24h)
  const stalePending = await pool.request().query(`
    SELECT TOP 10
      Id,
      ISNULL(Customer, 'Unknown') AS Customer,
      OrderDate
    FROM Orders
    WHERE PaymentStatus = 'Pending'
      AND OrderDate < DATEADD(HOUR, -24, GETDATE())
    ORDER BY OrderDate ASC
  `);
  for (const row of stalePending.recordset) {
    const hrs = Math.floor(
      (Date.now() - new Date(row.OrderDate).getTime()) / 3600000
    );
    items.push({
      id: `pending-${row.Id}`,
      type: "stale_pending",
      title: "Pending Order Overdue",
      body: `${row.Customer} — ${hrs}h ago`,
      severity: "warning",
    });
  }

  // 4. Recent returns (last 24h)
  const recentReturns = await pool.request().query(`
    SELECT TOP 5
      r.Id,
      r.Reason,
      r.CreatedAt,
      COUNT(ri.Id) AS ItemCount
    FROM SalesReturns r
    LEFT JOIN SalesReturnItems ri ON ri.ReturnId = r.Id
    WHERE r.CreatedAt >= DATEADD(HOUR, -24, GETDATE())
    GROUP BY r.Id, r.Reason, r.CreatedAt
    ORDER BY r.CreatedAt DESC
  `);
  for (const row of recentReturns.recordset) {
    items.push({
      id: `return-${row.Id}`,
      type: "recent_return",
      title: "Recent Return",
      body: `${row.ItemCount} item(s) — ${row.Reason}`,
      severity: "info",
    });
  }

  return items;
}
