-- PostgreSQL schema for essencefit-dashboard, translated from db/full_schema.sql
-- (SQL Server). Strategy "Option B": all identifiers lowercase so the app's
-- unquoted PascalCase SQL folds and matches; the data layer (src/lib/sqlShim.ts)
-- maps result-row keys back to PascalCase. Types mapped:
--   uniqueidentifier->uuid, nvarchar(n)/(max)->text, datetime2->timestamp,
--   bit->boolean, decimal(p,s)->numeric(p,s), int->integer.
-- Defaults: newid()->gen_random_uuid(), sysutcdatetime()/getdate()->now().
-- Stored procedures, the TVP type and the 3 unused views are intentionally omitted
-- (the app issues no EXEC and references none of the views).

-- ============================ TABLES ============================

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  createdat timestamp NOT NULL DEFAULT now(),
  slug text,
  imageurl text,
  description text,
  isactive boolean NOT NULL DEFAULT true,
  sortorder integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  createdat timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  createdat timestamp NOT NULL DEFAULT now(),
  hex text
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  passwordhash text NOT NULL,
  role text NOT NULL DEFAULT 'Staff',
  createdat timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text,
  notes text,
  createdat timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  createdat timestamp NOT NULL DEFAULT now(),
  email text,
  passwordhash text
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text NOT NULL UNIQUE,
  categoryid uuid NOT NULL,
  costprice numeric(18,2) NOT NULL,
  sellingprice numeric(18,2) NOT NULL,
  createdat timestamp NOT NULL DEFAULT now(),
  slug text,
  description text,
  imageurl text,
  compareatprice numeric(18,2),
  isactive boolean NOT NULL DEFAULT true,
  isfeatured boolean NOT NULL DEFAULT false,
  sortorder integer NOT NULL DEFAULT 0,
  isnewarrival boolean NOT NULL DEFAULT false,
  isdtfprintable boolean NOT NULL DEFAULT false,
  blankproductid uuid,
  dtfprofit numeric(10,2),
  printondemand boolean NOT NULL DEFAULT false,
  sizecharturl text,
  selectbyimage boolean NOT NULL DEFAULT false,
  utilities numeric(18,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS productvariants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  productid uuid NOT NULL,
  sizeid uuid,
  colorid uuid,
  qty integer NOT NULL DEFAULT 0,
  sellingprice numeric(18,2),
  createdat timestamp NOT NULL DEFAULT now(),
  costprice numeric(18,2)
);

CREATE TABLE IF NOT EXISTS productimages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  productid uuid NOT NULL,
  url text NOT NULL,
  sortorder integer NOT NULL DEFAULT 0,
  createdat timestamp NOT NULL DEFAULT now(),
  colorid uuid,
  variantid uuid
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer text,
  paymentstatus text NOT NULL,
  orderdate timestamp NOT NULL DEFAULT now(),
  subtotal numeric(18,2),
  discount numeric(18,2),
  deliveryfee numeric(18,2),
  total numeric(18,2),
  customerid uuid,
  customerphone text,
  address text,
  manualdiscount numeric(18,2) DEFAULT 0,
  completedat timestamp,
  secondaryphone text,
  waybillid text,
  packageprintprice numeric(18,2),
  notes text,
  source text,
  customeremail text,
  paymentmethod text,
  paymentslipurl text,
  paymentverified boolean NOT NULL DEFAULT false,
  province text,
  stockdeducted boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS orderitems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orderid uuid NOT NULL,
  variantid uuid NOT NULL,
  qty integer NOT NULL,
  sellingprice numeric(18,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variantid uuid NOT NULL,
  qty integer NOT NULL CHECK (qty > 0),
  sellingprice numeric(18,2) NOT NULL,
  paymentmethod text NOT NULL DEFAULT 'cash',
  paymentstatus text NOT NULL DEFAULT 'Paid',
  saledate timestamp NOT NULL DEFAULT now(),
  orderid uuid,
  dtforderid uuid,
  costprice numeric(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  userid uuid NOT NULL,
  amount numeric(18,2) NOT NULL,
  handoverdate timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cashusage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric(18,2) NOT NULL,
  usagedate timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  description text,
  amount numeric(18,2) NOT NULL,
  expensedate timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplierid uuid NOT NULL,
  variantid uuid NOT NULL,
  qty integer NOT NULL,
  costprice numeric(18,2) NOT NULL,
  paymentstatus text NOT NULL,
  purchasedate timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchasereturns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplierid uuid NOT NULL,
  reason text,
  createdat timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchasereturnitems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  returnid uuid NOT NULL,
  variantid uuid NOT NULL,
  qty integer NOT NULL
);

CREATE TABLE IF NOT EXISTS salesreturns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orderid uuid,
  reason text,
  createdat timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salesreturnitems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  returnid uuid NOT NULL,
  variantid uuid NOT NULL,
  qty integer NOT NULL
);

CREATE TABLE IF NOT EXISTS stockhistory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variantid uuid NOT NULL,
  changeqty integer NOT NULL,
  reason text NOT NULL,
  userid uuid,
  createdat timestamp NOT NULL DEFAULT now(),
  previousqty integer,
  newqty integer,
  priceatchange numeric(18,2)
);

CREATE TABLE IF NOT EXISTS orderstatuslogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orderid uuid NOT NULL,
  oldstatus text,
  newstatus text NOT NULL,
  changedat timestamp NOT NULL DEFAULT now(),
  changedby text
);

CREATE TABLE IF NOT EXISTS dispatchmessages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orderid uuid NOT NULL,
  waybillid text NOT NULL,
  customername text,
  customerphone text,
  createdat timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS colorrequests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customername text,
  phone text NOT NULL,
  productname text NOT NULL,
  colorname text NOT NULL,
  sizename text,
  notes text,
  status text NOT NULL DEFAULT 'Pending',
  createdat timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  updatedat timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dtftemplates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  language text NOT NULL DEFAULT 'Sinhala',
  sortorder integer NOT NULL DEFAULT 0,
  isactive boolean NOT NULL DEFAULT true,
  createdat timestamp NOT NULL DEFAULT now(),
  updatedat timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dtfquotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quoteref text NOT NULL,
  customername text,
  customerphone text,
  garmentname text NOT NULL,
  printnames text,
  quantity integer NOT NULL DEFAULT 1,
  garmentcost numeric(10,2) NOT NULL DEFAULT 0,
  printcost numeric(10,2) NOT NULL DEFAULT 0,
  packaging numeric(10,2) NOT NULL DEFAULT 0,
  utilities numeric(10,2) NOT NULL DEFAULT 0,
  profit numeric(10,2) NOT NULL DEFAULT 0,
  unitprice numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  breakdownjson text,
  createdat timestamp NOT NULL DEFAULT now(),
  extra numeric(10,2) NOT NULL DEFAULT 0,
  finaltotal numeric(10,2) NOT NULL DEFAULT 0,
  advancepct numeric(5,2) NOT NULL DEFAULT 0,
  advanceamount numeric(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dtfpriceitems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  name text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  unit text,
  sortorder integer NOT NULL DEFAULT 0,
  isactive boolean NOT NULL DEFAULT true,
  updatedat timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dtforders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL,
  customername text NOT NULL,
  customerphone text NOT NULL,
  whatsapp text,
  email text,
  address text,
  productid uuid NOT NULL,
  variantid uuid,
  qty integer NOT NULL DEFAULT 1,
  printoptions text,
  customernote text,
  garmentprice numeric(10,2) NOT NULL DEFAULT 0,
  printcharges numeric(10,2) NOT NULL DEFAULT 0,
  estimatedtotal numeric(10,2) NOT NULL DEFAULT 0,
  breakdownjson text,
  finaltotal numeric(10,2),
  advanceamount numeric(10,2),
  status text NOT NULL DEFAULT 'Pending',
  stockdeducted boolean NOT NULL DEFAULT false,
  adminnote text,
  createdat timestamp NOT NULL DEFAULT now(),
  confirmedat timestamp,
  customerid uuid
);

CREATE TABLE IF NOT EXISTS dtforderdesigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dtforderid uuid NOT NULL,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'image',
  sortorder integer NOT NULL DEFAULT 0
);

-- Admin-managed customer reviews, each assigned to a product (category derived
-- via products.categoryid). reviewimages holds the optional gallery photos.
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  productid uuid NOT NULL,
  customername text NOT NULL,
  customerimage text,
  rating smallint NOT NULL DEFAULT 5,
  message text NOT NULL,
  ispublished boolean NOT NULL DEFAULT true,
  sortorder integer NOT NULL DEFAULT 0,
  createdat timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviewimages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewid uuid NOT NULL,
  url text NOT NULL,
  sortorder integer NOT NULL DEFAULT 0,
  createdat timestamp NOT NULL DEFAULT now()
);

-- Admin-managed custom-orders gallery: each item is a customer's order with
-- the artwork they sent and photos of the delivered product, both in the
-- galleryimages child table (kind = 'artwork' | 'final').
-- galleryitems.artworkurl is legacy (superseded by kind='artwork' rows;
-- migrated by db/28, no longer written).
CREATE TABLE IF NOT EXISTS galleryitems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customername text NOT NULL,
  artworkurl text,
  caption text,
  isfeatured boolean NOT NULL DEFAULT false,
  ispublished boolean NOT NULL DEFAULT true,
  sortorder integer NOT NULL DEFAULT 0,
  createdat timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS galleryimages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  galleryitemid uuid NOT NULL,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'final',
  sortorder integer NOT NULL DEFAULT 0,
  createdat timestamp NOT NULL DEFAULT now()
);

-- Admin-managed feedback wall: each item is one customer-feedback screenshot
-- (WhatsApp chat etc.) with an optional customer name. Screenshot-first:
-- no product link, rating, or message.
CREATE TABLE IF NOT EXISTS feedbackitems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customername text,
  imageurl text NOT NULL,
  ispublished boolean NOT NULL DEFAULT true,
  sortorder integer NOT NULL DEFAULT 0,
  createdat timestamp NOT NULL DEFAULT now()
);

-- ============================ INDEXES ============================

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_phone ON customers (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_dtforders_customerid ON dtforders (customerid);
CREATE INDEX IF NOT EXISTS ix_dtforders_status ON dtforders (status);
CREATE INDEX IF NOT EXISTS ix_dtforderdesigns_orderid ON dtforderdesigns (dtforderid);
CREATE INDEX IF NOT EXISTS ix_productimages_product_color ON productimages (productid, colorid);
CREATE INDEX IF NOT EXISTS ix_productimages_productid ON productimages (productid);
CREATE INDEX IF NOT EXISTS ix_productimages_variantid ON productimages (variantid);
CREATE INDEX IF NOT EXISTS ix_orders_customerid ON orders (customerid);
CREATE INDEX IF NOT EXISTS ix_dispatchmessages_createdat ON dispatchmessages (createdat DESC);
CREATE INDEX IF NOT EXISTS ix_orderstatuslogs_changedat ON orderstatuslogs (changedat DESC);
CREATE INDEX IF NOT EXISTS ix_orderstatuslogs_newstatus ON orderstatuslogs (newstatus);
CREATE INDEX IF NOT EXISTS ix_orderstatuslogs_orderid ON orderstatuslogs (orderid);
CREATE INDEX IF NOT EXISTS ix_sales_orderid ON sales (orderid);
CREATE INDEX IF NOT EXISTS ix_sales_dtforderid ON sales (dtforderid);
CREATE INDEX IF NOT EXISTS ix_reviews_productid ON reviews (productid);
CREATE INDEX IF NOT EXISTS ix_reviewimages_reviewid ON reviewimages (reviewid);
CREATE INDEX IF NOT EXISTS ix_galleryimages_galleryitemid ON galleryimages (galleryitemid);

-- ============================ FOREIGN KEYS ============================

ALTER TABLE products            ADD CONSTRAINT fk_products_category   FOREIGN KEY (categoryid)  REFERENCES categories (id);
ALTER TABLE productvariants     ADD CONSTRAINT fk_variants_product    FOREIGN KEY (productid)   REFERENCES products (id);
ALTER TABLE productvariants     ADD CONSTRAINT fk_variants_color      FOREIGN KEY (colorid)     REFERENCES colors (id);
ALTER TABLE productvariants     ADD CONSTRAINT fk_variants_size       FOREIGN KEY (sizeid)      REFERENCES sizes (id);
ALTER TABLE orders              ADD CONSTRAINT fk_orders_customers    FOREIGN KEY (customerid)  REFERENCES customers (id);
ALTER TABLE orderitems          ADD CONSTRAINT fk_orderitems_order    FOREIGN KEY (orderid)     REFERENCES orders (id);
ALTER TABLE orderitems          ADD CONSTRAINT fk_orderitems_variant  FOREIGN KEY (variantid)   REFERENCES productvariants (id);
ALTER TABLE sales               ADD CONSTRAINT fk_sales_orders        FOREIGN KEY (orderid)     REFERENCES orders (id) ON DELETE CASCADE;
ALTER TABLE sales               ADD CONSTRAINT fk_sales_variant       FOREIGN KEY (variantid)   REFERENCES productvariants (id);
ALTER TABLE sales               ADD CONSTRAINT fk_sales_dtforders     FOREIGN KEY (dtforderid)  REFERENCES dtforders (id) ON DELETE CASCADE;
ALTER TABLE handovers           ADD CONSTRAINT fk_handovers_user      FOREIGN KEY (userid)      REFERENCES users (id);
ALTER TABLE purchases           ADD CONSTRAINT fk_purchases_supplier  FOREIGN KEY (supplierid)  REFERENCES suppliers (id);
ALTER TABLE purchases           ADD CONSTRAINT fk_purchases_variant   FOREIGN KEY (variantid)   REFERENCES productvariants (id);
ALTER TABLE salesreturnitems    ADD CONSTRAINT fk_sri_return          FOREIGN KEY (returnid)    REFERENCES salesreturns (id);
ALTER TABLE purchasereturnitems ADD CONSTRAINT fk_pri_return          FOREIGN KEY (returnid)    REFERENCES purchasereturns (id);
ALTER TABLE dispatchmessages    ADD CONSTRAINT fk_dispatch_order      FOREIGN KEY (orderid)     REFERENCES orders (id);
ALTER TABLE orderstatuslogs     ADD CONSTRAINT fk_osl_orders          FOREIGN KEY (orderid)     REFERENCES orders (id);
ALTER TABLE stockhistory        ADD CONSTRAINT fk_stockhistory_user   FOREIGN KEY (userid)      REFERENCES users (id);
ALTER TABLE stockhistory        ADD CONSTRAINT fk_stockhistory_variant FOREIGN KEY (variantid)  REFERENCES productvariants (id);

-- ============================ FUNCTION ============================
-- Called from app SQL as dbo.fn_StockVariantId(...) (folds to dbo.fn_stockvariantid).
CREATE SCHEMA IF NOT EXISTS dbo;

CREATE OR REPLACE FUNCTION dbo.fn_stockvariantid(p_variantid uuid)
RETURNS uuid AS $$
DECLARE
  v_res uuid := p_variantid;
  v_blank uuid;
  v_size uuid;
  v_color uuid;
BEGIN
  SELECT p.blankproductid, v.sizeid, v.colorid
    INTO v_blank, v_size, v_color
  FROM productvariants v
  JOIN products p ON p.id = v.productid
  WHERE v.id = p_variantid;

  IF v_blank IS NOT NULL THEN
    SELECT b.id INTO v_res
    FROM productvariants b
    WHERE b.productid = v_blank
      AND COALESCE(b.sizeid::text, '') = COALESCE(v_size::text, '')
      AND COALESCE(b.colorid::text, '') = COALESCE(v_color::text, '')
    LIMIT 1;
    IF v_res IS NULL THEN
      v_res := p_variantid;
    END IF;
  END IF;

  RETURN v_res;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================ VIRTUAL TRY-ON ============================
-- Usage log: one row per generation attempt, used only to enforce per-IP and
-- global daily caps on the /api/tryon route. No customer photo is ever stored.
CREATE TABLE IF NOT EXISTS tryonusage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  createdat timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tryonusage_created ON tryonusage (createdat);
