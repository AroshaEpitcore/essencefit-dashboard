-- Link custom-orders gallery items to storefront products, so an item can be
-- surfaced on the assigned product's PDP. Many-to-many: one gallery item may
-- belong to several products, and a product may have several gallery items.
-- Also present in db/pg/schema.sql; idempotent, safe to re-run.
CREATE TABLE IF NOT EXISTS galleryitemproducts (
  galleryitemid uuid NOT NULL,
  productid     uuid NOT NULL,
  PRIMARY KEY (galleryitemid, productid)
);

CREATE INDEX IF NOT EXISTS ix_galleryitemproducts_productid ON galleryitemproducts (productid);
