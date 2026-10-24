-- DTF orders adopt the canonical delivery/discount model (same as Orders).
-- Recorded separately on the DtfOrders row for the audit trail; the synced DTF
-- `sales` row then nets the discount off revenue and folds the owner-paid
-- delivery cost into COGS, so profit flows through the existing Sales-based
-- readers with no reader changes. Idempotent.
--   discount     = real discount on the DTF job (reduces revenue)
--   deliveryfee  = delivery the customer pays (pass-through; excluded from P&L)
--   deliverycost = delivery the owner pays the courier on free delivery (a cost)

ALTER TABLE dtforders ADD COLUMN IF NOT EXISTS discount numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE dtforders ADD COLUMN IF NOT EXISTS deliveryfee numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE dtforders ADD COLUMN IF NOT EXISTS deliverycost numeric(18,2) NOT NULL DEFAULT 0;
