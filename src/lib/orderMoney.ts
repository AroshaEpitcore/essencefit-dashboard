// Canonical order money model (pure, no DB) — the single definition the whole
// app should agree with. See workflow/plans/2026-10-24-order-sales-financial-model.md.
//
//   subtotal     = goods gross (Σ line price)
//   discount     = real discounts on goods (contra-revenue)
//   deliveryFee  = delivery the CUSTOMER pays (pass-through; NOT business income)
//   deliveryCost = delivery the OWNER pays the courier on free delivery (an expense)
//   cogs         = cost of goods sold
//
//   Total (customer pays) = subtotal − discount + deliveryFee
//   Net revenue           = subtotal − discount            (delivery fee excluded)
//   Net profit            = net revenue − cogs − deliveryCost

export type OrderMoneyInput = {
  subtotal: number;
  discount?: number;
  deliveryFee?: number;
  deliveryCost?: number;
  cogs?: number;
};

const n = (v: number | undefined) => Number(v ?? 0);

/** What the customer pays. Free delivery does NOT reduce it (delivery isn't a
 *  discount); it's clamped at 0. */
export function orderTotal(i: OrderMoneyInput): number {
  return Math.max(0, n(i.subtotal) - n(i.discount) + n(i.deliveryFee));
}

/** Business goods revenue — customer-paid delivery is pass-through, excluded. */
export function orderNetRevenue(i: OrderMoneyInput): number {
  return n(i.subtotal) - n(i.discount);
}

/** Net profit = revenue − COGS − owner-paid delivery cost. */
export function orderNetProfit(i: OrderMoneyInput): number {
  return orderNetRevenue(i) - n(i.cogs) - n(i.deliveryCost);
}
