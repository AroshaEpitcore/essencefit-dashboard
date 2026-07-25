-- General-purpose (non-DTF) quotation builder table.
-- Also present in db/pg/schema.sql; idempotent, safe to re-run.
CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quoteref text NOT NULL,                 -- e.g. QUO-1001
  customername text,
  customerphone text,
  customeremail text,
  customeraddress text,
  itemsjson text,                         -- JSON array: [{ description, qty, unitPrice, amount }]
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  othercharge numeric(12,2) NOT NULL DEFAULT 0,
  grandtotal numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  validuntil date,
  status text NOT NULL DEFAULT 'Draft',
  createdat timestamp NOT NULL DEFAULT now()
);
