-- Hardening round (plan: workflow/plans/2026-07-05-storefront-admin-gap-analysis.md, Phase 1)
-- Run AFTER db/pg/patches/2026-07-05-merge-duplicate-variants.mjs (the unique
-- guards below require the duplicates to be merged first).
-- Idempotent: everything is IF NOT EXISTS. Also mirrored in db/pg/schema.sql.

-- Hot-path indexes (research gap #18)
CREATE INDEX IF NOT EXISTS ix_orderitems_orderid        ON orderitems (orderid);
CREATE INDEX IF NOT EXISTS ix_orderitems_variantid      ON orderitems (variantid);
CREATE INDEX IF NOT EXISTS ix_productvariants_productid ON productvariants (productid);
CREATE INDEX IF NOT EXISTS ix_stockhistory_variantid    ON stockhistory (variantid);
CREATE INDEX IF NOT EXISTS ix_stockhistory_createdat    ON stockhistory (createdat DESC);
CREATE INDEX IF NOT EXISTS ix_sales_variantid           ON sales (variantid);
CREATE INDEX IF NOT EXISTS ix_sales_saledate            ON sales (saledate);
CREATE INDEX IF NOT EXISTS ix_products_categoryid       ON products (categoryid);
CREATE INDEX IF NOT EXISTS ix_orders_source_orderdate   ON orders (source, orderdate DESC);

-- Structural guards against the duplicate-lookup/variant data bug:
-- two colours named "White" split Ck Sport short's XL/White stock across two
-- variant rows and the PDP resolved the empty one.
CREATE UNIQUE INDEX IF NOT EXISTS ux_colors_name ON colors (LOWER(TRIM(name)));
CREATE UNIQUE INDEX IF NOT EXISTS ux_sizes_name  ON sizes  (LOWER(TRIM(name)));
CREATE UNIQUE INDEX IF NOT EXISTS ux_variants_product_size_color
  ON productvariants (productid, sizeid, colorid)
  WHERE sizeid IS NOT NULL AND colorid IS NOT NULL;
