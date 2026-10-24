-- Canonical money model: separate owner-paid delivery cost from discounts.
--
-- Until now, admin free-delivery was folded into orders.discount (and
-- orders.deliveryfee was always 0), while web orders booked a customer-paid
-- deliveryfee as income. New model:
--   * discount      = real discounts on goods only (contra-revenue)
--   * deliveryfee   = delivery charged to the customer (pass-through; NOT income)
--   * deliverycost  = delivery the OWNER pays the courier (free-delivery); an expense
-- Net revenue = subtotal - discount ; Net profit = net revenue - COGS - deliverycost.
--
-- Backfill is profit-neutral for admin orders: the delivery part folded into
-- discount is moved to deliverycost, and discount is reset to the real
-- manualdiscount. (manualdiscount was always stored separately.) Idempotent.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS deliverycost numeric(18,2) NOT NULL DEFAULT 0;

UPDATE orders
SET deliverycost = GREATEST(COALESCE(discount, 0) - COALESCE(manualdiscount, 0), 0),
    discount     = COALESCE(manualdiscount, 0)
WHERE COALESCE(discount, 0) > COALESCE(manualdiscount, 0);
