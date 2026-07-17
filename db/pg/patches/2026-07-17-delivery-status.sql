-- Delivery / fulfillment status on orders (separate from PaymentStatus).
-- PaymentStatus drives sales + stock; this tracks the physical delivery journey
-- (Processing -> Ready -> Handed to courier -> Delivered -> Returned) and is
-- shown to both admins and customers. Idempotent. Mirrored in db/pg/schema.sql.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS deliverystatus text NOT NULL DEFAULT 'Processing';

CREATE INDEX IF NOT EXISTS ix_orders_deliverystatus ON orders (deliverystatus);
