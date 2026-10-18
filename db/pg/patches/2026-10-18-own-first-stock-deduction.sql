-- Own-first-then-blank stock — DEDUCTION + exact-split returns (Piece 2).
-- Additive: new table + two functions. Does NOT modify fn_stockvariantid,
-- fn_available_qty, or any stored stock on apply.

-- Records how a deducted line split across the OWN pool (the ordered variant)
-- and the BLANK pool, so a return/cancel reverses each pool exactly.
-- refid = Orders.Id (reftype 'order') or DtfOrders.Id (reftype 'dtf').
CREATE TABLE IF NOT EXISTS stockallocation (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refid          uuid NOT NULL,
  reftype        text NOT NULL,
  variantid      uuid NOT NULL,        -- the ordered variant (own pool)
  owntaken       int  NOT NULL DEFAULT 0,
  blankvariantid uuid,                 -- resolved blank variant (null if none)
  blanktaken     int  NOT NULL DEFAULT 0,
  createdat      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_stockallocation_ref ON stockallocation (refid);

-- Deduct p_qty of a variant, OWN first then overflow to its blank. Atomic via
-- FOR UPDATE. Returns true if fully deducted, false if total (own+blank) is
-- short (caller throws -> tx rollback). Writes a StockHistory row per pool
-- touched and one stockallocation row recording the split.
CREATE OR REPLACE FUNCTION dbo.deduct_stock(
  p_variantid uuid, p_qty int, p_refid uuid, p_reftype text, p_reason text
) RETURNS boolean AS $$
DECLARE
  v_own int; v_blank uuid; v_bqty int := 0;
  v_fo int; v_fb int; v_price numeric;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN RETURN true; END IF;

  SELECT qty INTO v_own FROM productvariants WHERE id = p_variantid FOR UPDATE;
  IF v_own IS NULL THEN RETURN false; END IF;
  v_own := COALESCE(v_own, 0);

  v_blank := dbo.fn_stockvariantid(p_variantid);
  IF v_blank = p_variantid THEN v_blank := NULL; END IF;
  IF v_blank IS NOT NULL THEN
    SELECT COALESCE(qty, 0) INTO v_bqty FROM productvariants WHERE id = v_blank FOR UPDATE;
  END IF;

  IF p_qty > v_own + v_bqty THEN RETURN false; END IF;

  v_fo := LEAST(p_qty, v_own);   -- from own
  v_fb := p_qty - v_fo;          -- overflow from blank

  IF v_fo > 0 THEN
    SELECT COALESCE(pv.sellingprice, p.sellingprice, 0) INTO v_price
      FROM productvariants pv JOIN products p ON p.id = pv.productid WHERE pv.id = p_variantid;
    UPDATE productvariants SET qty = qty - v_fo WHERE id = p_variantid;
    INSERT INTO stockhistory (variantid, changeqty, reason, previousqty, newqty, priceatchange, createdat)
      VALUES (p_variantid, -v_fo, p_reason, v_own, v_own - v_fo, COALESCE(v_price, 0), now());
  END IF;

  IF v_fb > 0 THEN
    SELECT COALESCE(pv.sellingprice, p.sellingprice, 0) INTO v_price
      FROM productvariants pv JOIN products p ON p.id = pv.productid WHERE pv.id = v_blank;
    UPDATE productvariants SET qty = qty - v_fb WHERE id = v_blank;
    INSERT INTO stockhistory (variantid, changeqty, reason, previousqty, newqty, priceatchange, createdat)
      VALUES (v_blank, -v_fb, p_reason, v_bqty, v_bqty - v_fb, COALESCE(v_price, 0), now());
  END IF;

  INSERT INTO stockallocation (refid, reftype, variantid, owntaken, blankvariantid, blanktaken)
    VALUES (p_refid, p_reftype, p_variantid, v_fo, v_blank, v_fb);
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Reverse every recorded split for a ref, putting each pool back exactly, then
-- delete the allocation rows. Returns the number of allocation rows reversed;
-- 0 means a legacy ref (deducted before Piece 2) that the caller restores the
-- old way.
CREATE OR REPLACE FUNCTION dbo.restore_stock(p_refid uuid, p_reason text)
RETURNS int AS $$
DECLARE r record; v_prev int; v_price numeric; v_n int := 0;
BEGIN
  FOR r IN SELECT * FROM stockallocation WHERE refid = p_refid LOOP
    v_n := v_n + 1;
    IF r.owntaken > 0 THEN
      SELECT qty INTO v_prev FROM productvariants WHERE id = r.variantid FOR UPDATE;
      SELECT COALESCE(pv.sellingprice, p.sellingprice, 0) INTO v_price
        FROM productvariants pv JOIN products p ON p.id = pv.productid WHERE pv.id = r.variantid;
      UPDATE productvariants SET qty = qty + r.owntaken WHERE id = r.variantid;
      INSERT INTO stockhistory (variantid, changeqty, reason, previousqty, newqty, priceatchange, createdat)
        VALUES (r.variantid, r.owntaken, p_reason, COALESCE(v_prev,0), COALESCE(v_prev,0) + r.owntaken, COALESCE(v_price,0), now());
    END IF;
    IF r.blanktaken > 0 AND r.blankvariantid IS NOT NULL THEN
      SELECT qty INTO v_prev FROM productvariants WHERE id = r.blankvariantid FOR UPDATE;
      SELECT COALESCE(pv.sellingprice, p.sellingprice, 0) INTO v_price
        FROM productvariants pv JOIN products p ON p.id = pv.productid WHERE pv.id = r.blankvariantid;
      UPDATE productvariants SET qty = qty + r.blanktaken WHERE id = r.blankvariantid;
      INSERT INTO stockhistory (variantid, changeqty, reason, previousqty, newqty, priceatchange, createdat)
        VALUES (r.blankvariantid, r.blanktaken, p_reason, COALESCE(v_prev,0), COALESCE(v_prev,0) + r.blanktaken, COALESCE(v_price,0), now());
    END IF;
  END LOOP;
  DELETE FROM stockallocation WHERE refid = p_refid;
  RETURN v_n;
END;
$$ LANGUAGE plpgsql;
