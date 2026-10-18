-- Admin-configurable storefront promo popups + their analytics. Idempotent.
CREATE TABLE IF NOT EXISTS popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  isactive boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  layout text NOT NULL DEFAULT 'center',
  heading text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  imageurl text,
  ctatext text,
  ctalink text,
  couponcode text,
  accentcolor text,
  triggertype text NOT NULL DEFAULT 'delay',
  triggervalue integer NOT NULL DEFAULT 30,
  frequency text NOT NULL DEFAULT 'session',
  showon text NOT NULL DEFAULT 'all',
  device text NOT NULL DEFAULT 'all',
  audience text NOT NULL DEFAULT 'all',
  startat timestamp,
  endat timestamp,
  createdat timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS popup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  popupid uuid NOT NULL,
  event text NOT NULL,
  visitorid text,
  createdat timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_popup_events_popupid ON popup_events (popupid);
