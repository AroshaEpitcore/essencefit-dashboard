-- Per-line DTF print support on orderitems.
-- Lets a normal customer order carry a print-on-demand DTF line with its own
-- print cost. When the order goes Paid/Completed, that line becomes a Sales row
-- with PaymentMethod='DTF' and CostPrice = blank + utilities + printcost, so it
-- lands in the DTF dashboard tiles and profit. Idempotent.
ALTER TABLE orderitems ADD COLUMN IF NOT EXISTS printcost numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE orderitems ADD COLUMN IF NOT EXISTS isdtf boolean NOT NULL DEFAULT false;
