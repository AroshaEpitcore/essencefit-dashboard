-- Own-first-then-blank stock — availability helper (Piece 1: DISPLAY ONLY).
-- Additive and safe: does NOT alter dbo.fn_stockvariantid and does NOT touch
-- any stored stock. Returns a variant's OWN Qty PLUS its blank's matching Qty
-- (when the product is print-on-demand linked to a blank), i.e. the true
-- number sellable under "sell own stock first, then print on the blank".
-- Deduction/returns are handled separately in Piece 2.
CREATE OR REPLACE FUNCTION dbo.fn_available_qty(p_variantid uuid)
RETURNS int AS $$
DECLARE
  v_own   int;
  v_blank uuid;
  v_bqty  int := 0;
BEGIN
  SELECT qty INTO v_own FROM productvariants WHERE id = p_variantid;
  IF v_own IS NULL THEN RETURN 0; END IF;
  v_blank := dbo.fn_stockvariantid(p_variantid);
  IF v_blank IS NOT NULL AND v_blank <> p_variantid THEN
    SELECT COALESCE(qty, 0) INTO v_bqty FROM productvariants WHERE id = v_blank;
  END IF;
  RETURN COALESCE(v_own, 0) + COALESCE(v_bqty, 0);
END;
$$ LANGUAGE plpgsql STABLE;
