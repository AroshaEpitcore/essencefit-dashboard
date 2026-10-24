// Plain (non-"use server") module for shared types.
// A "use server" file may export ONLY async functions — a type/const export
// there crashes the module at load with a masked "Server Components render"
// 500 (see memory use-server-async-exports-only). Keep these here.

export type ItemProfitFilters = {
  category?: string;
  product?: string;
  channel?: string;
  from?: string;
  to?: string;
};

/** Order-level amounts for a period (business-wide; can't be attributed to a
 * single item) — real discounts given and delivery cost the owner paid couriers
 * on free-delivery orders. Both reduce net profit. */
export type OrderAdjustments = { Discount: number; DeliveryCost: number };

/** Real print-job figures for a period (from the printjobs table) — shown for
 * reference on the PrintJob channel card. The synced sale row only carries the
 * profit, so Revenue/Cost here are view-only and don't affect the totals. */
export type PrintJobTotals = { Qty: number; Revenue: number; Cost: number; Profit: number };

/** Variant-level sales row (per channel) — cost, revenue and profit separate. */
export type ItemProfitRow = {
  Category: string;
  Product: string;
  Size: string;
  Color: string;
  PaymentMethod: string;
  Qty: number;
  Revenue: number;
  Cost: number;
  Profit: number;
};
