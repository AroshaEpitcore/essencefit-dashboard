---
date: 2026-06-21
slug: order-and-stock-sync-audit
status: implementing
surfaces: [admin, storefront, db]
research: workflow/research/2026-06-21-order-and-stock-sync-audit.md
estimated_manual_effort: 1h 30m
---

# Order / Stock Sync — Implementation Plan

## Overview
Close the consistency gaps found in the audit so all order channels keep the shared stock pool, the stock ledger, and the admin views in sync:
1. **Cancel restores stock** for regular (web + admin) orders, with an idempotent `Orders.StockDeducted` flag so toggling Canceled ⇄ active never double-counts (mirrors `DtfOrders.StockDeducted`).
2. **Order-driven stock movements are logged to `StockHistory`** (web + admin), so `/stock-history` is a complete ledger like DTF already is.
3. **Admin display fixes**: show `Province` in Web Orders, and read the **resolved blank** stock/cost in admin order detail & recent-order cost for linked products.

## Estimated Manual Effort
**1h 30m** — human review per phase + manual verification at each pause + final `/validate`, with a 10% buffer. Claude Code implements; no dev hours counted.

## Current State
- Regular orders deduct stock at creation and only restore on **edit** (`updateOrder`) and **delete** (`deleteOrder`); `updateOrderStatus` never restores, so **Canceled keeps stock deducted** (`src/app/(main)/orders/actions.ts:487-555` vs `:569,663`). DTF cancel restores (`src/app/(main)/dtf-orders/actions.ts:146-171`).
- Web + admin stock decrement/restore go through `dbo.fn_StockVariantId` but **do not write `StockHistory`** (`checkout/actions.ts:209-213`; `orders/actions.ts:274-279,282-292`). DTF + manual ops do log it with `(VariantId, ChangeQty, Reason, PreviousQty, NewQty, PriceAtChange, CreatedAt)` (`stocks/actions.ts:187-190`; `dtf-orders/actions.ts:114,166`).
- `getWebOrders` doesn't select `Orders.Province` (`web-orders/actions.ts:8-23`). Admin reads use the ordered variant, not the blank: `getOrderDetails` `v.Qty`/`v.CostPrice` (`orders/actions.ts:240-241`), `getRecentOrders` `TotalCost` (`:198-202`).
- `Orders` has no `StockDeducted` column.

## Desired End State
- Setting any regular order to **Canceled** returns its stock to the (resolved) pool exactly once and logs a `StockHistory` "order-cancel" row; reactivating a canceled order re-deducts (with availability check) and logs an "order-sale" row. Edit/delete remain correct and never double-restore.
- Placing/paying normal web & admin orders writes `StockHistory` "order-sale" rows; restores write "order-return"/"order-cancel" rows.
- Web Orders list shows the customer's `Province`; admin order detail & recent-order cost reflect the **blank** variant for linked products.
- Unlinked products and the existing DTF flow behave exactly as before.

## What We're NOT Doing
- Not changing the stock-timing model (web/admin still reserve at creation; DTF at confirm).
- Not creating Sales/finance rows for DTF (unchanged).
- Not adding a stock-history UI filter by channel (the rows just appear in the existing list).
- No app/public-site (none in repo).

## Touchpoints per surface
- **DB**: `db/21_order_stock_sync.sql` — `Orders.StockDeducted BIT NOT NULL DEFAULT 1`.
- **Admin orders**: `src/app/(main)/orders/actions.ts` — stock helpers (history), `updateOrderStatus` (reconcile), `updateOrder`/`deleteOrder` (flag-guarded restore), `getOrderDetails`/`getRecentOrders` (resolved reads).
- **Web checkout**: `src/app/(shop)/checkout/actions.ts` — log `StockHistory` on decrement.
- **Web Orders admin**: `src/app/(main)/web-orders/actions.ts` + `page.tsx` — Province column.
- **Tenancy**: single-tenant — n/a.

---

## Phase 1: DB — `Orders.StockDeducted` flag
### Changes
#### `db/21_order_stock_sync.sql` (idempotent; apply with `node db/apply.mjs`)
```sql
IF COL_LENGTH('Orders','StockDeducted') IS NULL
  ALTER TABLE Orders ADD StockDeducted BIT NOT NULL CONSTRAINT DF_Orders_StockDeducted DEFAULT 1;
GO
```
Existing orders all had stock deducted at creation and (per the gap) were never auto-restored — so `DEFAULT 1` for all existing rows is correct, including already-Canceled ones (their stock is still out; reactivating them later will see flag=1 and not re-deduct).

### Success Criteria
#### Automated
- [x] Migration applies and re-runs clean (`node db/apply.mjs db/21_order_stock_sync.sql`).
- [x] App builds: `npm run build`
#### Manual
- [ ] `SELECT COUNT(*) FROM Orders WHERE StockDeducted=1` equals total orders.

**Pause here** for confirmation.

---

## Phase 2: Stock helpers log history + flag-aware restore
### Changes — `src/app/(main)/orders/actions.ts`
- **`validateAndReduceStock(tx, items, reason='order-sale')`**: keep the per-item availability check + `UPDATE … fn_StockVariantId`; additionally read the resolved variant's `Qty` (before) + `SellingPrice` and insert a `StockHistory` row `(VariantId=resolved, ChangeQty=-Qty, Reason, PreviousQty, NewQty, PriceAtChange, GETDATE())`.
- **`restoreStockFromOrder(tx, orderId, reason='order-return')`**: convert the single set-based UPDATE to a per-item loop (read resolved `Qty` before, `UPDATE`, insert `StockHistory` with `ChangeQty=+Qty`). Resolve via `dbo.fn_StockVariantId(oi.VariantId)`.
- These helpers now always log, so web/admin order stock movements appear in `/stock-history`.

### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] Creating an admin order (Paid) deducts stock and adds an `order-sale` row in `/stock-history`; editing it shows return+sale rows.

**Pause here** for confirmation.

---

## Phase 3: Cancel ⇄ reactivate reconciliation (web + admin)
### Changes — `src/app/(main)/orders/actions.ts`
- Add helper **`reconcileOrderStock(tx, orderId, newStatus, items)`**:
  - read `StockDeducted` for the order;
  - `shouldDeduct = newStatus !== 'Canceled'`;
  - if `shouldDeduct && !StockDeducted` → `validateAndReduceStock(tx, items, 'order-sale')` then set `StockDeducted=1`;
  - if `!shouldDeduct && StockDeducted` → `restoreStockFromOrder(tx, orderId, 'order-cancel')` then set `StockDeducted=0`;
  - else no-op.
- **`updateOrderStatus`**: after updating status/logs, load the order's items and call `reconcileOrderStock(tx, orderId, newStatus, items)` inside the existing transaction (before commit). (Web Orders cancel/verify flow through this, so they inherit it.)
- **`updateOrder` (edit)**: guard the leading `restoreStockFromOrder` to run **only if** the order is currently `StockDeducted=1`; after re-inserting items, deduct only if `payload.PaymentStatus !== 'Canceled'` and set `StockDeducted` to match (`1` if deducted, else `0`).
- **`deleteOrder`**: guard `restoreStockFromOrder` to run **only if** `StockDeducted=1` (don't restore an already-canceled order).
- **`createOrder`** / **`createWebOrder`**: no flag write needed — the `DEFAULT 1` applies (both INSERTs omit the column and always deduct at creation).

### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] Web order → **Canceled**: stock returns to the pool (verify `/stocks`), an `order-cancel` row appears, `StockDeducted=0`.
- [ ] Same order **Canceled → Paid**: stock deducts again (blocked if insufficient), `order-sale` row, `StockDeducted=1`.
- [ ] **Delete** a Canceled order: stock does **not** change again (no double restore).
- [ ] A linked product's cancel/reactivate moves the **blank** pool; an unlinked product unchanged.

**Pause here** for confirmation.

---

## Phase 4: Web checkout logs StockHistory
### Changes — `src/app/(shop)/checkout/actions.ts`
- In the items loop (`:199-213`), before/after the `UPDATE ProductVariants … fn_StockVariantId`, read the resolved variant's `Qty` and insert a `StockHistory` `order-sale` row (same shape as Phase 2). Mirror the existing per-item structure so the web "Pending" order's deduction is logged at placement.

### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] Placing a web order adds `order-sale` rows in `/stock-history` for each line, against the resolved (blank when linked) variant.

**Pause here** for confirmation.

---

## Phase 5: Admin display — Province + resolved blank reads
### Changes
#### `src/app/(main)/web-orders/actions.ts`
- `getWebOrders`: add `o.Province` to the SELECT.
#### `src/app/(main)/web-orders/page.tsx`
- Show `Province` in the order row/detail (near address).
#### `src/app/(main)/orders/actions.ts`
- `getOrderDetails`: `CurrentStock` and `CostPrice` read the resolved variant — `(SELECT z.Qty FROM ProductVariants z WHERE z.Id=dbo.fn_StockVariantId(oi.VariantId))` and likewise `CostPrice` (fallback to product cost).
- `getRecentOrders`: `TotalCost` sums `ISNULL((SELECT z.CostPrice FROM ProductVariants z WHERE z.Id=dbo.fn_StockVariantId(oi.VariantId)), p2.CostPrice)` so linked products use the blank's cost.

### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] A web order placed with a province shows it in `/web-orders`.
- [ ] For a linked product, admin order detail shows the **blank**'s current stock and cost; recent-orders cost/margin uses the blank cost.

**Pause here**, then run `/validate order-and-stock-sync-audit`.

## Testing Strategy
No automated tests. Per-phase gate = `npm run build` (+ the Phase 1 migration via `node db/apply.mjs`). End-to-end: (1) place a web order → `order-sale` history + stock down; (2) cancel it → stock restored + `order-cancel` history + `StockDeducted=0`; (3) reactivate to Paid → re-deducted + Sales rows created; (4) delete a canceled order → no extra stock change; (5) repeat with a blank-linked product to confirm the pool moves; (6) confirm an unlinked product and the DTF flow are unchanged (regression).

## References
- Research: `workflow/research/2026-06-21-order-and-stock-sync-audit.md`
- Stock helpers + status: `src/app/(main)/orders/actions.ts:264-292,487-555`
- DTF reserve/restore + history pattern to mirror: `src/app/(main)/dtf-orders/actions.ts:78-185`
- StockHistory insert shape: `src/app/(main)/stocks/actions.ts:187-190`
- Web order create/decrement: `src/app/(shop)/checkout/actions.ts:199-213`
- Web orders list: `src/app/(main)/web-orders/actions.ts:6-25`
- Resolver: `db/18_shared_stock.sql` (`fn_StockVariantId`)
- Industry standard considered: an idempotent "stock committed" flag per order + an append-only stock ledger is the conventional inventory pattern; this mirrors the existing `DtfOrders.StockDeducted` design rather than introducing a new reservations table. (n/a external lib.)
