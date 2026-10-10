-- Print Jobs (job-work printing).
--
-- A supplier (the owner's father, or any supplier) hands over a batch of blank
-- garments. We buy DTF prints from the DTF shop (we pay that cost), print them,
-- and hand the finished garments back. We're paid per garment for the print
-- work; part of that charge is our profit.
--
--   charge/unit = dtf cost/unit (we pay) + profit/unit (we keep)
--
-- There is NO selling of garments and NO inventory movement — the blanks are
-- not ours. But the profit must show up in Dashboard / Finance / Reports, which
-- all read the `sales` table, so each batch also writes ONE synced `sales` row
-- (PaymentMethod='PrintJob') against a hidden variant under a dedicated
-- "Print Jobs" product. That keeps the Sales->ProductVariants->Products joins
-- resolving without touching any real stock.
--
-- Idempotent; also present in db/pg/schema.sql. Safe to re-run.

CREATE TABLE IF NOT EXISTS printjobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL,                                   -- e.g. PJ-1001
  giver text,                                          -- father / supplier name (free text)
  garment text,                                        -- e.g. 'T-shirts' (free text)
  qty int NOT NULL DEFAULT 1,
  dtfcostperunit numeric(12,2) NOT NULL DEFAULT 0,     -- paid to the DTF shop, per garment
  profitperunit numeric(12,2) NOT NULL DEFAULT 0,      -- our profit, per garment
  chargeperunit numeric(12,2) NOT NULL DEFAULT 0,      -- dtfcostperunit + profitperunit
  totalcost numeric(12,2) NOT NULL DEFAULT 0,          -- dtfcostperunit * qty
  totalcharge numeric(12,2) NOT NULL DEFAULT 0,        -- chargeperunit * qty
  totalprofit numeric(12,2) NOT NULL DEFAULT 0,        -- profitperunit * qty
  status text NOT NULL DEFAULT 'Pending',              -- Pending | HandedOver
  handedoverat timestamp,
  note text,
  createdat timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_printjobs_createdat ON printjobs (createdat);

-- Link a print job's synced sale row back to the job, so editing/deleting the
-- job can keep Sales in sync (mirrors sales.dtforderid).
ALTER TABLE sales ADD COLUMN IF NOT EXISTS printjobid uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sales_printjobs') THEN
    ALTER TABLE sales ADD CONSTRAINT fk_sales_printjobs
      FOREIGN KEY (printjobid) REFERENCES printjobs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Dedicated, storefront-hidden "Print Jobs" product + hidden variant that the
-- synced sales rows point at. Kept inactive so it never appears in the shop.
DO $$
DECLARE cat_id uuid; prod_id uuid; var_id uuid;
BEGIN
  SELECT id INTO cat_id FROM categories WHERE name = 'Print Jobs' LIMIT 1;
  IF cat_id IS NULL THEN
    INSERT INTO categories (name, isactive) VALUES ('Print Jobs', false) RETURNING id INTO cat_id;
  END IF;

  SELECT id INTO prod_id FROM products WHERE name = 'Print Jobs' LIMIT 1;
  IF prod_id IS NULL THEN
    INSERT INTO products (name, sku, categoryid, costprice, sellingprice, isactive)
    VALUES ('Print Jobs', 'PRINT-JOBS', cat_id, 0, 0, false) RETURNING id INTO prod_id;
  END IF;

  SELECT id INTO var_id FROM productvariants
    WHERE productid = prod_id AND sizeid IS NULL AND colorid IS NULL LIMIT 1;
  IF var_id IS NULL THEN
    INSERT INTO productvariants (productid, sizeid, colorid, qty) VALUES (prod_id, NULL, NULL, 0);
  END IF;
END $$;
