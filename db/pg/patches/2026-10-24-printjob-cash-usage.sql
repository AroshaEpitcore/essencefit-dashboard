-- Print-job DTF cost -> Cash Usage
--
-- A print job's DTF cost is money paid out of pocket to the DTF shop. It had no
-- cash-out record anywhere (it is only the CostPrice on the synced sales row,
-- which the profit reports net correctly), so the Finance page's "Total Sales"
-- counted the full charge as money-in while "Remaining" never dropped by the
-- cost -- overstating the till balance by the DTF cost.
--
-- Link a Cash Usage row to each print job (ON DELETE CASCADE, mirroring
-- sales.printjobid) so creating a job records the cash-out and deleting the job
-- removes it. Idempotent; also reflected in db/pg/schema.sql. Safe to re-run.

ALTER TABLE cashusage ADD COLUMN IF NOT EXISTS printjobid uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cashusage_printjobs') THEN
    ALTER TABLE cashusage ADD CONSTRAINT fk_cashusage_printjobs
      FOREIGN KEY (printjobid) REFERENCES printjobs(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_cashusage_printjobid ON cashusage (printjobid);

-- Backfill existing print jobs that have no cash-usage entry yet, so the
-- current Finance balance corrects immediately.
INSERT INTO cashusage (description, amount, usagedate, printjobid)
SELECT 'Print job ' || pj.ref || ' — DTF cost (' || pj.qty || ' × Rs ' || pj.dtfcostperunit || ')',
       pj.totalcost, pj.createdat, pj.id
FROM printjobs pj
WHERE pj.totalcost > 0
  AND NOT EXISTS (SELECT 1 FROM cashusage cu WHERE cu.printjobid = pj.id);
