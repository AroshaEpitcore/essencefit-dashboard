/* ============================================================
   24_dtf_sales_sync.sql
   Let a Completed DTF order contribute a Sales row (so it counts
   in Dashboard/Reports/Finance, which read Sales exclusively).
   Sales.OrderId is FK'd to Orders — a DtfOrders.Id can't go there —
   so DTF-sourced rows leave OrderId NULL and use this new column
   instead, to identify/dedupe them on status/price changes.
   Additive, idempotent. Safe to re-run.
   ============================================================ */

IF COL_LENGTH('Sales','DtfOrderId') IS NULL
  ALTER TABLE Sales ADD DtfOrderId UNIQUEIDENTIFIER NULL
        CONSTRAINT FK_Sales_DtfOrders REFERENCES DtfOrders(Id) ON DELETE CASCADE;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Sales_DtfOrderId')
  CREATE INDEX IX_Sales_DtfOrderId ON Sales(DtfOrderId);
GO
