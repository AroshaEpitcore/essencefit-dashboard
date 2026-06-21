/* ============================================================
   17_order_account_linkage.sql
   Link DTF orders to customer accounts + backfill all orders.
   Additive, idempotent. Safe to re-run.
   ============================================================ */

IF COL_LENGTH('DtfOrders','CustomerId') IS NULL
  ALTER TABLE DtfOrders ADD CustomerId UNIQUEIDENTIFIER NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_DtfOrders_CustomerId')
  CREATE INDEX IX_DtfOrders_CustomerId ON DtfOrders(CustomerId);
GO

/* Backfill DTF orders to a customer by phone, else by email. */
UPDATE d SET d.CustomerId = c.Id
FROM DtfOrders d
JOIN Customers c ON c.Phone = d.CustomerPhone
WHERE d.CustomerId IS NULL;

UPDATE d SET d.CustomerId = c.Id
FROM DtfOrders d
JOIN Customers c ON c.Email = d.Email
WHERE d.CustomerId IS NULL AND d.Email IS NOT NULL;
GO

/* Backfill any unlinked regular orders by phone. */
UPDATE o SET o.CustomerId = c.Id
FROM Orders o
JOIN Customers c ON c.Phone = o.CustomerPhone
WHERE o.CustomerId IS NULL;
GO
