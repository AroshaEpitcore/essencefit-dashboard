-- New stock: Regular Black Polo Collar T-Shirt (Polo T-Shirts category)
-- Colour: Black only. Sizes/qty: M=20, L=30, XL=30, XXL=20.
-- 190gsm plain blank tee, DTF printable. Cost 1050, Sell 1650 (profit 600), utilities 0.
-- Fully idempotent: category/colour/sizes are ensured; the product + its variants +
-- stock-history are created once (guarded by SKU) so re-running never doubles stock.

DO $$
DECLARE
  v_cat     uuid;
  v_black   uuid;
  v_m uuid; v_l uuid; v_xl uuid; v_xxl uuid;
  v_prod    uuid;
  v_sku     text := 'REGULAR-BLACK-POLO-COLLAR-TSHIRT';
BEGIN
  -- Category: Polo T-Shirts (slug generated the same way the admin Catalog editor
  -- does: slugify(name) + '-' + first 8 hex of the row id, so its nav link resolves).
  SELECT id INTO v_cat FROM categories WHERE lower(trim(name)) = 'polo t-shirts' LIMIT 1;
  IF v_cat IS NULL THEN
    INSERT INTO categories (name) VALUES ('Polo T-Shirts') RETURNING id INTO v_cat;
    UPDATE categories SET slug = 'polo-t-shirts-' || substr(replace(v_cat::text, '-', ''), 1, 8)
    WHERE id = v_cat AND slug IS NULL;
  END IF;

  -- Colour: Black
  SELECT id INTO v_black FROM colors WHERE lower(trim(name)) = 'black' LIMIT 1;
  IF v_black IS NULL THEN
    INSERT INTO colors (name, hex) VALUES ('Black', '#000000') RETURNING id INTO v_black;
  END IF;

  -- Sizes: M / L / XL / XXL
  SELECT id INTO v_m   FROM sizes WHERE lower(trim(name)) = 'm'   LIMIT 1;
  IF v_m   IS NULL THEN INSERT INTO sizes (name) VALUES ('M')   RETURNING id INTO v_m;   END IF;
  SELECT id INTO v_l   FROM sizes WHERE lower(trim(name)) = 'l'   LIMIT 1;
  IF v_l   IS NULL THEN INSERT INTO sizes (name) VALUES ('L')   RETURNING id INTO v_l;   END IF;
  SELECT id INTO v_xl  FROM sizes WHERE lower(trim(name)) = 'xl'  LIMIT 1;
  IF v_xl  IS NULL THEN INSERT INTO sizes (name) VALUES ('XL')  RETURNING id INTO v_xl;  END IF;
  SELECT id INTO v_xxl FROM sizes WHERE lower(trim(name)) = 'xxl' LIMIT 1;
  IF v_xxl IS NULL THEN INSERT INTO sizes (name) VALUES ('XXL') RETURNING id INTO v_xxl; END IF;

  -- Product (idempotent by SKU)
  SELECT id INTO v_prod FROM products WHERE sku = v_sku LIMIT 1;
  IF v_prod IS NULL THEN
    INSERT INTO products
      (categoryid, name, sku, costprice, sellingprice, utilities,
       description, isdtfprintable, isactive)
    VALUES
      (v_cat, 'Regular Black Polo Collar T-Shirt', v_sku, 1050, 1650, 0,
       'Regular black polo-collar T-shirt in premium 190gsm cotton. Plain blank tee — DTF printable, perfect for custom prints. Available in M, L, XL and XXL.',
       true, true)
    RETURNING id INTO v_prod;

    -- Storefront slug (so the product page link resolves instead of 404-ing).
    UPDATE products
       SET slug = 'regular-black-polo-collar-t-shirt-' || substr(replace(v_prod::text, '-', ''), 1, 8)
     WHERE id = v_prod AND slug IS NULL;

    -- Variants (Black + each size) with starting stock, and a stock-add history row each.
    DECLARE
      s_ids  uuid[] := ARRAY[v_m, v_l, v_xl, v_xxl];
      s_qty  int[]  := ARRAY[20,  30,  30,   20];
      v_var  uuid;
      i      int;
    BEGIN
      FOR i IN 1..4 LOOP
        INSERT INTO productvariants (productid, sizeid, colorid, qty, costprice, sellingprice)
        VALUES (v_prod, s_ids[i], v_black, s_qty[i], 1050, 1650)
        RETURNING id INTO v_var;

        INSERT INTO stockhistory (variantid, changeqty, reason, previousqty, newqty, priceatchange)
        VALUES (v_var, s_qty[i], 'stock-add', 0, s_qty[i], 1650);
      END LOOP;
    END;

    RAISE NOTICE 'Created product % with 4 variants (100 units total).', v_prod;
  ELSE
    RAISE NOTICE 'Product % already exists — no changes made.', v_prod;
  END IF;
END $$;
