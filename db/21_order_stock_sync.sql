/* ---------- Orders: stock-committed flag ----------
   Tracks whether a regular order currently holds stock out of the pool, so
   moving to/from Canceled restores/re-deducts exactly once (mirrors
   DtfOrders.StockDeducted). Existing orders all deducted at creation and were
   never auto-restored, so DEFAULT 1 is correct for the backfill. */

IF COL_LENGTH('Orders', 'StockDeducted') IS NULL
  ALTER TABLE Orders ADD StockDeducted BIT NOT NULL CONSTRAINT DF_Orders_StockDeducted DEFAULT 1;
GO
