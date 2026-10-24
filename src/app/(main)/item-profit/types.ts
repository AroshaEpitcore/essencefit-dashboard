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

/** Order-level adjustments for a period (business-wide; can't be attributed to
 * a single item) — free-delivery/discounts given and delivery fees collected. */
export type OrderAdjustments = { Discount: number; DeliveryFee: number };

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
