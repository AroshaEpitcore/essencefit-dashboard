---
date: 2026-06-21
topic: "Do all order flows (web, admin, DTF), stock, accounts, and delivery stay in sync / connected with each other?"
backend_commit: 9cb6f25
app_commit: n/a
public_site_commit: n/a
status: complete
tags: [research, orders, stock, dtf, accounts, checkout, delivery]
---

# Research: Order / Stock / Account / Delivery Sync Audit

## Research Question
"Please double check is all functions — orders and everything — sync with each other / connect with each other." i.e. after the recent shared-stock, DTF-pricing, account-linkage, province-delivery and storefront changes, do the order, stock, customer-account and delivery flows all stay consistent and wired together?

## Summary
The system has **three order entry points** that all write to the same `Orders`/`OrderItems` (regular) or `DtfOrders` (custom) tables, and **one shared stock pool** keyed by `ProductVariants.Qty` and resolved through the scalar function `dbo.fn_StockVariantId` (the "blank" resolver).

The core wiring is **consistent**:
- **Every stock read and write that flows through an order goes through `dbo.fn_StockVariantId`** — web checkout, admin orders, DTF confirm/cancel, and all storefront/admin stock reads. So a linked product and its blank share one pool everywhere stock is *decremented/restored*.
- **Customer linkage is consistent**: web checkout, DTF submit, and admin orders all set `Orders.CustomerId` / `DtfOrders.CustomerId` (by session or phone upsert), and the customer "My orders" view re-matches by `CustomerId OR phone OR email`, so all three surfaces show up for the customer.
- **Sales/finance rows** are created by one shared path (`updateOrderStatus`) for both admin and web orders when status becomes Paid/Completed; DTF intentionally never creates Sales rows.

There are a small number of **intentional asymmetries and two genuine consistency gaps** worth knowing (documented below, NOT fixed here):
1. **Canceling a regular order via status change does NOT restore stock** (only edit/delete do) — whereas **DTF cancel DOES restore stock**. (Pre-existing; already noted in the DTF research.)
2. **Regular orders (web + admin) do not write `StockHistory`** rows; only DTF confirm/cancel and manual stock ops do — so `/stock-history` shows DTF + manual movements but not order-driven ones.
Plus minor display-only items: admin order detail/recent-cost reads use the *ordered* variant (not the resolved blank), and the admin Web Orders list captures but doesn't display `Province`.

## Detailed Findings

### Stock resolver — used consistently for order decrements/restores
The blank resolver `dbo.fn_StockVariantId(@VariantId)` returns the blank's matching (size+colour) variant id when a product is linked, else the same id (`db/18_shared_stock.sql`).

- **Web checkout** reads availability and decrements through it:
  - read: `ISNULL((SELECT z.Qty FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(v.Id)),0) AS Stock` (`src/app/(shop)/checkout/actions.ts:81`)
  - write: `UPDATE ProductVariants SET Qty = Qty - @Qty WHERE Id = dbo.fn_StockVariantId(@VariantId)` (`src/app/(shop)/checkout/actions.ts:212`)
- **Admin orders** (`src/app/(main)/orders/actions.ts`):
  - `validateAndReduceStock` reads + decrements via the resolver (`:268`, `:278`)
  - `restoreStockFromOrder` restores via the resolver (`:289`)
  - lookups `getVariant` (`:73`) and `getVariantStockByProductAndSize` (`:96`) read via the resolver
- **DTF confirm/cancel** (`src/app/(main)/dtf-orders/actions.ts`): resolves once to `StockVid` then updates that id (`:95`, `:106`, `:149`, `:158`).
- **Storefront/catalog reads** resolve to the blank pool (`src/lib/storefront.ts` `PRODUCT_SELECT`/`getProductVariants`; `src/app/(main)/catalog/actions.ts:46`).

### Three order entry points → shared tables
- **Web order**: `createWebOrder` inserts `Orders` with `Source='web'`, `PaymentStatus='Pending'`, decrements stock immediately, logs `OrderStatusLogs`, does NOT create Sales (`src/app/(shop)/checkout/actions.ts:166-223`).
- **Admin order**: `createOrder` inserts `Orders` (no `Source` → admin), decrements stock immediately, creates Sales **only** if status Paid/Completed (`src/app/(main)/orders/actions.ts:380-456`).
- **DTF order**: `createDtfOrder` inserts `DtfOrders` with `Status='Pending'`, `StockDeducted=0`, and **does not touch stock** — stock is reserved only at admin **Confirm** (`src/app/(shop)/customize/actions.ts:42-150`; reserve at `dtf-orders/actions.ts:78-130`).

So the **stock-timing model differs by channel** (intentional): web + admin reserve at creation; DTF reserves at confirm.

### Customer account linkage — connected across all three
- Web checkout: uses the session customer, else upserts by phone and creates a login account; sets `Orders.CustomerId` and auto-signs-in (`src/app/(shop)/checkout/actions.ts:59-164,178`).
- DTF: same pattern, sets `DtfOrders.CustomerId` (`src/app/(shop)/customize/actions.ts:51-150`).
- Admin order: `upsertCustomerTx` matches/creates a `Customers` row by phone and sets `Orders.CustomerId` (no password = guest) (`src/app/(main)/orders/actions.ts:296-340,410`).
- Unified customer view: `getMyOrders` returns regular + DTF matched by `CustomerId OR CustomerPhone OR (CustomerEmail/Email)` and merges newest-first (`src/app/(shop)/account/actions.ts:115-172`); `getMyDtfOrder` is owner-scoped for the tracking page (`:176-205`).
- Backfill migration linked pre-existing rows by phone/email (`db/17_order_account_linkage.sql`).

### Sales / finance — one shared path
- `updateOrderStatus` deletes then recreates `Sales` rows when status is Paid/Completed, for both admin and web orders (`src/app/(main)/orders/actions.ts:487-555`).
- Web Orders admin reuses it: `verifyWebPayment` → `updateOrderStatus("Paid")`, `setWebOrderStatus` → `updateOrderStatus` (`src/app/(main)/web-orders/actions.ts:29-45`).
- DTF orders never create Sales rows (by design).

### Delivery / province
- Province fee resolved server-side from `Settings(delivery_provinces)` and stored on the order: `Orders.Province` + `DeliveryFee` (`src/app/(shop)/checkout/actions.ts:101-109,175,190`; column from `db/19_order_province.sql`).
- Cart shows "calculated at checkout" (no fixed fee) (`src/app/(shop)/cart/page.tsx`).
- Print-on-demand badge: `getWebOrders` computes `HasPrintOnDemand` from `Products.PrintOnDemand` and the page renders it (`src/app/(main)/web-orders/actions.ts:14-19`).

### Intentional asymmetries & consistency gaps (observed, not fixed)
1. **Cancel ≠ stock restore for regular orders.** `updateOrderStatus` never calls `restoreStockFromOrder`; stock is only returned on `updateOrder` (edit) and `deleteOrder` (`src/app/(main)/orders/actions.ts:487-555` vs `:569,663`). So a web/admin order moved to **Canceled** keeps its stock deducted. DTF cancel *does* restore (`src/app/(main)/dtf-orders/actions.ts:146-171`). (Already noted in `workflow/research/2026-06-20-dtf-printing-module.md:60`.)
2. **No `StockHistory` for order-driven movements.** Web checkout (`checkout/actions.ts:209-213`) and admin `validateAndReduceStock` (`orders/actions.ts:274-279`) update `Qty` without inserting `StockHistory`; only DTF confirm/cancel (`dtf-order`/`dtf-cancel`) and manual stock ops in `stocks/actions.ts` log history. So `/stock-history` won't show normal sales.
3. **Admin reads use the ordered variant, not the resolved blank** (display/reporting only): `getOrderDetails` `v.Qty AS CurrentStock` + `ISNULL(v.CostPrice,p.CostPrice)` (`orders/actions.ts:240-241`) and `getRecentOrders` `TotalCost` (`:198-202`). For a linked product the linked variant holds `Qty=0` and a copied cost, so current-stock and cost-based margin on those rows reflect the link row, not the blank.
4. **`Province` captured but not shown in admin.** `getWebOrders` doesn't select `Orders.Province` (`src/app/(main)/web-orders/actions.ts:8-23`), so the admin web-orders list doesn't display the chosen province (it is stored on the order and used for the fee).

## Code References
- `db/18_shared_stock.sql` — `fn_StockVariantId`, `BlankProductId`, `DtfProfit`, `PrintOnDemand`
- `db/17_order_account_linkage.sql` — `DtfOrders.CustomerId` + backfill
- `db/19_order_province.sql` — `Orders.Province`
- `db/20_product_size_chart.sql` — `Products.SizeChartUrl`
- `src/app/(shop)/checkout/actions.ts:59-223` — web order create (stock, customer, province, status log)
- `src/app/(main)/orders/actions.ts:264-292` — `validateAndReduceStock` / `restoreStockFromOrder`
- `src/app/(main)/orders/actions.ts:487-555` — `updateOrderStatus` (Sales recreate; no stock restore)
- `src/app/(main)/dtf-orders/actions.ts:78-185` — DTF confirm (reserve) / cancel (restore) + StockHistory
- `src/app/(shop)/customize/actions.ts:42-177` — DTF order create + customer link (no stock change)
- `src/app/(shop)/account/actions.ts:115-205` — unified `getMyOrders` + `getMyDtfOrder`
- `src/app/(main)/web-orders/actions.ts:6-49` — web orders list, verify/status (delegates to `updateOrderStatus`)

## Architecture / Conventions Observed
- **Single stock pool** per (product-or-blank, size, colour) in `ProductVariants.Qty`, resolved by `dbo.fn_StockVariantId`; all order channels decrement/restore through it.
- **Transactions** wrap every multi-write order operation (`sql.Transaction` begin/commit/rollback).
- **Server-authoritative pricing/stock**: web + DTF re-read price and stock from the DB; the client value is never trusted.
- **Shared status→Sales logic** in `orders/actions.ts`, reused by Web Orders.
- **Customer matching by `CustomerId OR phone OR email`** is the connective tissue between guest/admin/web/DTF orders and the account.

## Related Prior Work (from workflow/)
- `workflow/plans/2026-06-21-shared-stock-and-dtf-garment-pricing.md` & its research — defined the `fn_StockVariantId` resolver and where reads/writes use it.
- `workflow/plans/2026-06-21-dtf-order-customer-tracking.md` & its research — defined the account linkage + unified My-orders.
- `workflow/research/2026-06-20-dtf-printing-module.md:59-60` — first documented that `restoreStockFromOrder` runs on edit/delete but **not** on status→Canceled.
- `workflow/research/2026-06-19-ecommerce-storefront-transformation.md` — original order/Sales model.

## Open Questions
- Is "Canceled keeps stock deducted" for regular web/admin orders intended, or should Cancel restore stock like DTF does? (Customer web orders can be set to Canceled via `setWebOrderStatus`.)
- Should order-driven stock changes (web + admin) write `StockHistory` so `/stock-history` is a complete ledger, matching DTF's behaviour?
- Should admin Web Orders display `Province` (and admin order detail show the *resolved* blank stock/cost) for linked products?
