---
date: 2026-10-24
slug: order-sales-financial-model
status: implementing   # Phase 1 shipped (cf6a5bb), Phase 2 shipped (5c98bcd); Phases 3-4 pending
surfaces: [orders, web-checkout, dtf-orders, print-jobs, returns, dashboard, finance, reports, item-profit, analysis, store-settings, db]
research: workflow/research/2026-10-24-order-sales-financial-model.md
estimated_manual_effort: 2h 30m
---

# Order & Sales Financial Model — Implementation Plan

> Single-repo essencefit-dashboard (Next.js App Router + Supabase/`pg` + Vercel).
> Deterministic gate = `npx tsc --noEmit` + `NODE_OPTIONS=--dns-result-order=ipv4first npm run build`.
> Migrations are applied out-of-band via `node db/pg/apply.mjs <patch> DIRECT_URL`
> BEFORE deploying code that reads the new columns.

## Overview
Make one consistent, industry-standard money model: goods revenue = Subtotal −
Discount; delivery charged to the customer is **pass-through** (not income);
delivery the owner pays (free-delivery orders) is a **separate DeliveryCost**;
returns reverse revenue + COGS; delivery charges/free-delivery rule come from
Store Settings; DTF orders follow the same model. Keep discount and delivery-cost
as separate DB columns.

## Estimated Manual Effort
**2h 30m** — human-in-the-loop only: reviewing each phase, verifying before/after
totals against the DB at each pause, and the final validate. Implementation is by
Claude Code. Includes a 10% buffer.

## Current State
- One revenue ledger: `Sales` (gross = Σ Qty×SellingPrice, COGS = Σ Qty×CostPrice).
- Admin orders fold free-delivery saving into `Discount`; `DeliveryFee` always 0
  (`orders/actions.ts:188-193`, `orders/page.tsx:850-863`).
- Web orders book `DeliveryFee` as a real charge added to Total and counted as
  **income** in every P&L (`checkout/actions.ts:146-154,229-233`).
- Aggregations use `GrossSales − Discount + DeliveryFee` by day (dashboard
  `:45-81`, finance `:41-55`, reports `:103-295`, analysis `:131-155`).
- Returns only restock (`returns/actions.ts:128-156`) — no revenue/COGS reversal.
- Admin delivery charges hardcoded `[300,350,400]`; free-delivery = `totalQty>=3`.
- `ManualDiscount` already stored separately → lets us split historical `Discount`.

## Desired End State
Canonical formulas everywhere:
- **Net revenue** = Σ(Subtotal − Discount)  *(DeliveryFee excluded — pass-through)*
- **COGS** = Σ Qty×CostPrice
- **Net profit** = Net revenue − COGS − DeliveryCost
`Orders` stores `Discount` (real discounts only), `DeliveryFee` (customer-paid,
pass-through, label/record only), and new `DeliveryCost` (owner-paid courier fee).
Admin free-delivery profit is **unchanged** (reclassified discount→cost); web
pass-through delivery is **removed from income** (deliberate correction). Returns
reverse the sale. DTF orders follow the same model. Delivery config from Settings.

## What We're NOT Doing
- Not building a full double-entry ledger or accrual engine.
- Not retroactively inventing DeliveryCost for historical **web** free-delivery
  orders (not reliably identifiable) — only admin ones via `Discount−ManualDiscount`.
- Not changing `PackagePrintPrice` (stays label-only).
- Not touching stock deduction logic (verified sound).

## Phases (get buy-in, then execute one at a time)
1. **Canonical money model** — add `Orders.DeliveryCost`; backfill (admin:
   DeliveryCost = Discount−ManualDiscount, Discount = ManualDiscount); update ALL
   aggregation formulas to `Gross − Discount − DeliveryCost`, drop `+DeliveryFee`.
   Atomic (migration + all readers in one deploy). Profit-neutral for admin;
   removes web pass-through delivery from income.
2. **Order entry writes new fields** — admin + web set Discount (real only),
   DeliveryFee (customer-paid), DeliveryCost (owner-paid on free delivery);
   delivery charges + free-delivery rule from Store Settings.
3. **DTF orders** adopt the same delivery/discount model.
4. **Returns reverse revenue + COGS** (and restock) going forward.
5. **(Optional) SaleDate/attribution consistency** — attribute order
   discounts/costs by `OrderId` (now populated) instead of day-join; align SaleDate.

## Phase 1: Canonical money model (atomic)
### Changes
#### Migration — `db/pg/patches/2026-10-24-delivery-cost.sql`
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deliverycost numeric(18,2) NOT NULL DEFAULT 0;
-- Reclassify historical admin free-delivery savings: the delivery part was folded
-- into Discount; ManualDiscount holds the real discount. Profit-neutral.
UPDATE orders
SET deliverycost = GREATEST(COALESCE(discount,0) - COALESCE(manualdiscount,0), 0),
    discount     = COALESCE(manualdiscount, 0)
WHERE COALESCE(discount,0) > COALESCE(manualdiscount,0);
```
(+ reflect column in `db/pg/schema.sql`; add `deliverycost`→`DeliveryCost` to `columnCase.ts`.)
#### Aggregation readers (replace `GrossSales − Discount + DeliveryFee` → `GrossSales − Discount`; subtract `DeliveryCost` for profit)
- `dashboard/actions.ts` — OrdersAgg add `SUM(DeliveryCost)`; Sales/ThisMonth/AllTime use `GrossSales − Discount`; profit `(GrossSales − Cogs) − Discount − DeliveryCost`.
- `finance/actions.ts` — TotalSales `GrossSales − Discount`; no `+DeliveryFee`.
- `reports/actions.ts` — runSalesReport + runPnLReport: drop `+DeliveryFee`, subtract DeliveryCost in profit/COGS section.
- `analysis/actions.ts` — monthly trend uses `GrossSales − Discount` and subtracts DeliveryCost in profit.
- `item-profit/actions.ts` `getOrderAdjustments` — return `{ Discount, DeliveryCost }` (drop DeliveryFee); page Net Profit = gross − Discount − DeliveryCost; per-product allocation uses −(Discount+DeliveryCost).
### Success Criteria
#### Automated
- [ ] `npx tsc --noEmit` clean
- [ ] `NODE_OPTIONS=--dns-result-order=ipv4first npm run build` passes
#### Manual (verify against DB before/after)
- [ ] Business-wide AllTime profit **unchanged** vs pre-migration (admin reclass is neutral).
- [ ] This-month net profit drops by exactly Σ web pass-through DeliveryFee (expected).
- [ ] Item Profit Net Profit line still ties to Reports → P&L.

**Pause here** for confirmation.

---

## Phase 2: Order entry writes the new fields
### Changes
- `store-settings` — already has `deliveryFee`, province fees, `freeDeliveryCategoryQty`. Expose to admin orders.
- `orders/page.tsx` — delivery charge dropdown + free-delivery eligibility from Settings (not `[300,350,400]`/`totalQty>=3`); free delivery → DeliveryFee 0 + DeliveryCost = courier fee; paid delivery → DeliveryFee = fee; Discount = manual only; Total = Subtotal − ManualDiscount + DeliveryFee.
- `orders/actions.ts` — OrderPayload: drop folding; add `DeliveryCost`; store it in create/update.
- `checkout/actions.ts` — free delivery → DeliveryCost = waived baseFee, DeliveryFee 0; else DeliveryFee = baseFee, DeliveryCost 0.
### Success Criteria
#### Automated
- [ ] tsc + build pass.
#### Manual
- [ ] New admin order with free delivery: Discount = manual only, DeliveryCost = courier fee, Total = goods − manual; profit nets the courier cost.
- [ ] New admin paid-delivery order: DeliveryFee shows, not counted as profit.
- [ ] Web order free vs paid delivery store the right columns.

**Pause here.**

---

## Phase 3: DTF orders adopt the model
### Changes
- `dtf-orders/actions.ts` (+ its page) — support Discount + DeliveryFee/DeliveryCost consistently; synced Sales row keeps goods revenue/COGS; delivery cost recorded on the DTF order + flows to profit via the same aggregation.
### Success Criteria
- [ ] tsc + build; a DTF order with free delivery records DeliveryCost and nets profit; default (no free delivery) unchanged.

**Pause here.**

---

## Phase 4: Returns reverse revenue + COGS
### Changes
- `returns/actions.ts` `recordReturn` — in the same tx, reduce the matching `Sales` rows for the returned `OrderId`+`VariantId`+Qty (reverse revenue + COGS proportionally) in addition to restock. Record refund amount on `SalesReturns` if useful.
### Success Criteria
- [ ] tsc + build; a return reduces that product's revenue, COGS and profit in Reports/Item Profit by the returned units; stock restocked once.

**Pause here.**

## Phase 5 (optional): attribution consistency
Attribute order Discount/DeliveryCost by `Sales.OrderId` (now populated) instead
of the day-join; align SaleDate basis so period boundaries are exact. Deferred
unless the day-join boundary drift matters in practice.

## Testing Strategy
No automated suite. Each phase verified by before/after read-only SQL against the
live DB (safe single queries per `dont-load-test-live-db`) + the gate. The
non-negotiable check each phase: **business-wide AllTime profit only changes by
the amounts we intend** (admin reclass = 0; web pass-through removal = known).

## References
- Research: `workflow/research/2026-10-24-order-sales-financial-model.md`
- Memories: `untyped-null-param-42p08`, `print-jobs-module`, `category-qty-free-delivery`, `dont-load-test-live-db`, `use-server-async-exports-only`
- Industry standard: revenue recognition net of discounts (contra-revenue), shipping charged to customer as pass-through/income and shipping paid as an expense, returns reverse revenue+COGS — standard retail/e-comm accounting; this plan matches it while keeping the repo's single-`Sales`-ledger convention.
