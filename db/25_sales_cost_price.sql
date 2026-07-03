/* ============================================================
   25_sales_cost_price.sql
   Store the real per-unit cost on each Sales row at write-time,
   instead of every profit/report query re-deriving it from
   Products.CostPrice+Utilities (which is blind to DTF print/
   overhead costs and to shared-stock blank cost overrides).
   Additive, idempotent. Safe to re-run.
   ============================================================ */

IF COL_LENGTH('Sales','CostPrice') IS NULL
  ALTER TABLE Sales ADD CostPrice DECIMAL(10,2) NOT NULL DEFAULT 0;
GO
