// Own-first-then-blank stock allocation — pure model (no DB). The single TS
// definition of the "sell OWN stock first, then overflow to the BLANK" contract
// that the SQL functions implement. Keep this in lock-step with
//   db/pg/patches/2026-10-18-own-first-stock-available.sql   (fn_available_qty)
//   db/pg/patches/2026-10-18-own-first-stock-deduction.sql   (deduct_stock / restore_stock)
// so the invariants are regression-tested without a live DB.
//
//   available = own + blank                  (what fn_available_qty returns)
//   fromOwn   = min(req, own)                 (own pool drained first)
//   fromBlank = req − fromOwn                 (remainder overflows to the blank)
//   short     = req > own + blank             (nothing deducts; caller rolls back)

const n = (v: number | undefined | null) => Math.max(0, Math.floor(Number(v ?? 0)));

/** Total sellable for a variant: its OWN qty plus its blank's qty (0 when the
 *  product is not print-on-demand linked to a blank). Mirrors fn_available_qty. */
export function availableQty(ownQty: number | null | undefined, blankQty: number | null | undefined = 0): number {
  return n(ownQty) + n(blankQty);
}

export type Allocation = {
  /** false when the request exceeds own + blank — the SQL deduct_stock returns
   *  false and the caller throws, so NOTHING is deducted. */
  ok: boolean;
  /** units taken from the ordered variant's own pool. */
  fromOwn: number;
  /** units that overflowed onto the blank pool. */
  fromBlank: number;
  /** total units requested (clamped to >= 0). */
  requested: number;
};

/** Allocate `reqQty` across own-then-blank. Pure mirror of deduct_stock's split.
 *  A non-positive request is a no-op success (matches `p_qty <= 0 -> RETURN true`). */
export function allocate(
  ownQty: number | null | undefined,
  blankQty: number | null | undefined,
  reqQty: number | null | undefined
): Allocation {
  const own = n(ownQty);
  const blank = n(blankQty);
  const requested = n(reqQty);

  if (requested === 0) return { ok: true, fromOwn: 0, fromBlank: 0, requested: 0 };
  if (requested > own + blank) return { ok: false, fromOwn: 0, fromBlank: 0, requested };

  const fromOwn = Math.min(requested, own);
  const fromBlank = requested - fromOwn;
  return { ok: true, fromOwn, fromBlank, requested };
}

/** Apply an allocation to a pair of pools, returning the resulting quantities.
 *  Only used to express the deduct→restore round-trip invariant in tests and as
 *  a reference for callers; the DB does the real mutation under a row lock. */
export function applyAllocation(
  own: number,
  blank: number,
  alloc: Allocation
): { own: number; blank: number } {
  if (!alloc.ok) return { own, blank };
  return { own: own - alloc.fromOwn, blank: blank - alloc.fromBlank };
}

/** Reverse an allocation (cancel/return) — puts each pool back exactly. Mirrors
 *  restore_stock adding owntaken/blanktaken back to their respective variants. */
export function restoreAllocation(
  own: number,
  blank: number,
  alloc: Allocation
): { own: number; blank: number } {
  if (!alloc.ok) return { own, blank };
  return { own: own + alloc.fromOwn, blank: blank + alloc.fromBlank };
}
