-- Print jobs contribute ONLY their profit to all non-print-job pages.
--
-- Supersedes 2026-10-24-printjob-cash-usage.sql (same day). The garments aren't
-- ours and the DTF cost is a pass-through, so the synced sales row now carries
-- SellingPrice = profit/unit and CostPrice = 0 (NOT the charge/cost). That way
-- the general Sales/Cost/Profit totals everywhere pick up just the profit; the
-- full charge and DTF cost live only on the Print Jobs page (printjobs table).
-- The earlier Cash-Usage offset is therefore no longer needed and is removed.
-- Idempotent; safe to re-run.

-- 1. Re-point existing synced print-job sales rows to profit-only.
UPDATE sales s
SET sellingprice = pj.profitperunit,
    costprice = 0
FROM printjobs pj
WHERE s.printjobid = pj.id;

-- 2. Remove the (superseded) auto Cash-Usage rows and their link column.
DELETE FROM cashusage WHERE printjobid IS NOT NULL;
ALTER TABLE cashusage DROP CONSTRAINT IF EXISTS fk_cashusage_printjobs;
DROP INDEX IF EXISTS ix_cashusage_printjobid;
ALTER TABLE cashusage DROP COLUMN IF EXISTS printjobid;
