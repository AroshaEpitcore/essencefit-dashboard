-- WhatsApp bot pending orders (Phase 2c).
-- The bot COLLECTS an order (items + customer details) and writes a pending row
-- here. It does NOT touch stock. The owner reviews it in the admin and places
-- the real order with one click (which runs createOrder + deducts stock).
-- Idempotent.

CREATE TABLE IF NOT EXISTS wa_pending_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id         text NOT NULL,                  -- customer WhatsApp number
  customer_name text,
  address       text,
  phone         text,
  items         jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{product,size,colour,qty,price}]
  subtotal      numeric NOT NULL DEFAULT 0,
  delivery_fee  numeric NOT NULL DEFAULT 0,
  delivery_cost numeric NOT NULL DEFAULT 0,
  total         numeric NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'pending', -- pending | placed | rejected
  order_id      uuid,                            -- set when placed
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_pending_orders_status
  ON wa_pending_orders (status, created_at DESC);
