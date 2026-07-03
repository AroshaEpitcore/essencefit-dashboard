---
date: 2026-07-03
topic: "Why completed DTF orders don't show in Sales/Dashboard/Reports, and why the sidebar shows two active items on a DTF order page"
repo_commit: bd3cd89
status: complete
tags: [research, dtf, sales, dashboard, reports, sidebar, bug]
---

# Research: DTF Orders → Sales/Reports Gap & Sidebar Dual-Active Bug

> Single-repo **essencefit-dashboard** (Next.js 16 App Router, Postgres/Supabase via `pg`, `mssql`-shaped shim). Sections adapted to this codebase.

## Research Question
The owner added two DTF orders (DTF-O-1002, DTF-O-1003) and marked them "Completed", but they don't appear in the Sales page, admin Dashboard stats, or Reports. Also, viewing a DTF order highlights **two** items in the left sidebar simultaneously ("DTF Printing" and another DTF-related entry). Trace root cause for both.

## Summary
**Bug 1 — DTF orders never create a `Sales` row.** This is a known, previously-documented gap (`workflow/research/2026-06-21-order-and-stock-sync-audit.md:22,61`: "DTF intentionally never creates Sales rows"). Regular orders get a `Sales` row via `insertSalesRows`/`shouldCreateSales` in `orders/actions.ts` when status becomes Paid/Completed; `setDtfOrderStatus` in `dtf-orders/actions.ts` has no equivalent — it only ever does `UPDATE DtfOrders SET Status=@Status`. Since Dashboard (`dashboard/actions.ts`), Reports (`reports/actions.ts`), and Finance all read revenue **exclusively from the `Sales` table** (joined to `ProductVariants`/`Products`, with `Orders` only pulled in via a separate `FULL OUTER JOIN` for day-level discount/delivery adjustment — never required for a row to count), a completed DTF order is structurally invisible everywhere revenue is computed. There's no "Sales page listing" per se — `sales/page.tsx` is a manual quick-sell/backfill form, not a ledger view; the owner's "sales cannot see" report maps to Dashboard/Reports both reading only `Sales`.

**The fix is not as simple as inserting `Sales.OrderId = DtfOrders.Id`.** The live Postgres DB (confirmed directly, not just from the `db/pg/schema.sql` snapshot) has a real FK: `fk_sales_orders: FOREIGN KEY (orderid) REFERENCES orders(id) ON DELETE CASCADE`. A `DtfOrders.Id` would violate it. `Sales.OrderId` is nullable, so leaving it `NULL` for DTF-sourced rows works and doesn't break anything (no code anywhere joins `Sales` to `Orders` by id — confirmed via repo-wide grep), but there's then no column to later identify "which Sales row(s) came from which DTF order" for idempotent re-sync (needed so toggling status Completed→other→Completed, or an admin editing `FinalTotal` after completion, doesn't leave stale/duplicate rows).

**Bug 2 — sidebar active-state uses a naive prefix match.** `src/components/layout/Sidebar.tsx:90`: `const active = pathname.startsWith(item.href)`. Nav items include `{ href: "/dtf", label: "DTF Printing" }` and `{ href: "/dtf-orders", label: "DTF Orders" }` (`Sidebar.tsx:45-46`). For any DTF order page (`/dtf-orders` or `/dtf-orders/[id]`), `pathname.startsWith("/dtf")` is **also** true (`"/dtf-orders".startsWith("/dtf") === true`), so both items light up. No other nav pair in the current list collides this way (checked all 25 entries for shared prefixes at a segment boundary).

## Detailed Findings

### Sales-row creation — regular orders vs. DTF
- Regular order path: `shouldCreateSales(status)` → true for `Paid`/`Completed` (`src/app/(main)/orders/actions.ts:436-438`); `insertSalesRows` inserts one `Sales` row per `OrderItem` with `OrderId` set to the real `Orders.Id` (`:440-462`); `deleteSalesForOrder` does `DELETE FROM Sales WHERE OrderId=@OrderId` (`:464-468`); both are called from `updateOrderStatus` (`:579+`) so Sales rows are recreated to match current status on every status change (idempotent by delete-then-insert).
- DTF order path: `setDtfOrderStatus(id, status)` (`src/app/(main)/dtf-orders/actions.ts:132-184`) only ever does `UPDATE DtfOrders SET Status=@Status WHERE Id=@Id` (non-cancel branch, `:172-176`) or the stock-restoring cancel branch (`:145-176`). No `Sales` write anywhere in this file. `confirmDtfOrder` (`:77-129`) reserves stock but also never touches `Sales`.

### DtfOrders schema (`db/16_dtf_orders.sql:17-49`, `CustomerId` added later in `db/17_order_account_linkage.sql:7-8`)
Columns available to source a sale from: `ProductId` (NOT NULL), `VariantId` (**nullable** — "NULL if none chosen"), `Qty` (default 1), `GarmentPrice`, `PrintCharges`, `EstimatedTotal`, `FinalTotal` (admin override, nullable), `AdvanceAmount`, `Status`, `StockDeducted`, `CreatedAt` (default `SYSUTCDATETIME()`), `ConfirmedAt` (nullable, stamped only in `confirmDtfOrder`). **No `CompletedAt` column exists** — `setDtfOrderStatus` stamps nothing when status becomes `'Completed'`, so the only timestamp available for a Sales row's `SaleDate` is `CreatedAt` (matches how regular orders use `Orders.OrderDate`, not a status-change timestamp, for `Sales.SaleDate` — `orders/actions.ts:456` uses `orderDate` param, not `now()`).

### Sales table — live schema vs. mssql snapshot differ on enforcement
- `db/full_schema.sql:186-199` (mssql reference) shows `Sales.OrderId` as a plain nullable `uniqueidentifier`, no FK.
- **Live Postgres** (`db/pg/schema.sql:145-154,396-397`, confirmed against the actual DB via direct query): `sales.orderid uuid` (nullable) **with** `CONSTRAINT fk_sales_orders FOREIGN KEY (orderid) REFERENCES orders(id) ON DELETE CASCADE`, plus `fk_sales_variant FOREIGN KEY (variantid) REFERENCES productvariants(id)` (`variantid` is **NOT NULL** — a Sales row always needs a real variant).
- Direct query confirms these constraints are live today (`pg_constraint` on `sales`: `fk_sales_orders`, `fk_sales_variant`, `sales_pkey`, `sales_qty_check`).
- No code anywhere reads `Sales.OrderId` joined back to `Orders` (repo-wide grep for `Sales.*JOIN Orders`/`S.OrderId` — no matches), so a `NULL` `OrderId` on a Sales row is safe for every existing consumer.

### Dashboard / Reports / Finance — all read `Sales` directly, `Orders` only for day-level adjustment
- `src/app/(main)/dashboard/actions.ts:8-93` (`getDashboardStats`): `SalesAgg` CTE aggregates `Sales JOIN ProductVariants JOIN Products` by day; `OrdersAgg` CTE separately aggregates `Orders.Discount`/`DeliveryFee` for Paid/Completed orders; the two are combined with `FULL OUTER JOIN ... ON SA.D = OA.D` (`:30-39`) — a day with only `Sales` rows and no matching `Orders` day still flows through via `COALESCE`. Same pattern in `getChartData` (`:118-175`) and `getAnalyticsData` (`:177-255`, top products / revenue-by-category / weekly trend all key off `Sales` alone).
- `src/app/(main)/reports/actions.ts`: `runSalesReport` (`:95-173`), `runPnLReport` (`:201-252`), `runTopColorsReport` (`:277-352`) — identical shape: a `Sales`-driven CTE for the row set, an `Orders`-driven CTE only for discount/delivery, combined via `FULL OUTER JOIN`. `runInventoryReport`/`runDeadStockReport` don't touch `Sales`/`Orders` at all (pure `ProductVariants`).
- **Conclusion**: inserting a correctly-shaped `Sales` row (real `VariantId`, `Qty`, `SellingPrice`, `SaleDate`) is sufficient by itself to make a DTF sale appear in Dashboard totals/charts, Reports (Sales/PnL/Top Colors), and Finance — no other file needs to change to "see" it.

### `sales/page.tsx` is not a ledger
- `src/app/(main)/sales/actions.ts` exposes `sellStock` (manual quick-sell, inserts a bare `Sales` row) and `recordBackfill` (historical backfill entry) — both write, neither reads/lists. `src/app/(main)/sales/page.tsx` renders only the quick-sell/backfill forms (`getLookups`, `getProductsByCategory`, `getSizes`, `getVariantsByProductAndSize`, `sellStock`, `recordBackfill` — no `getSales`-style query exists in the file). So "checked Sales, cannot see" is really about Dashboard/Reports totals not moving, not a missing row in a Sales list (there isn't one).

### Sidebar active-state
- `src/components/layout/Sidebar.tsx:35-62` — flat `navItems` array, 25 entries, rendered as `<Link>`s.
- `src/components/layout/Sidebar.tsx:88-90`:
  ```js
  const active = pathname.startsWith(item.href);
  ```
- Colliding pair: `{ href: "/dtf", ... }` (`:45`) and `{ href: "/dtf-orders", ... }` (`:46`). For `pathname = "/dtf-orders"` or `"/dtf-orders/<id>"`, both `pathname.startsWith("/dtf")` and `pathname.startsWith("/dtf-orders")` are true → both list items get the active (`bg-gray-700 text-primary`) styling simultaneously.
- No other pair in the 25 `navItems` shares a prefix at a non-segment boundary (verified by inspection: e.g. `/stocks` vs `/stock-history` differ at character 7 `'s'` vs `'-'`, so no false match; `/orders` vs `/order-logs` differ at character 7 the same way).

## Code References
- `src/components/layout/Sidebar.tsx:45-46,88-90` — the colliding nav items + the naive `startsWith` active check.
- `src/app/(main)/dtf-orders/actions.ts:132-184` — `setDtfOrderStatus` (no Sales write); `:77-129` `confirmDtfOrder` (stock only).
- `src/app/(main)/orders/actions.ts:436-468` — `shouldCreateSales`/`insertSalesRows`/`deleteSalesForOrder`, the pattern to mirror.
- `db/16_dtf_orders.sql:17-49` — `DtfOrders` columns (no `CompletedAt`).
- `db/pg/schema.sql:145-154,396-397` — live `sales` table + `fk_sales_orders`/`fk_sales_variant` constraints.
- `src/app/(main)/dashboard/actions.ts:8-93,114-175,177-255` — all revenue/units/chart aggregates, `Sales`-driven.
- `src/app/(main)/reports/actions.ts:95-173,201-252,277-352` — Sales/PnL/Top-Colors reports, `Sales`-driven.
- `src/app/(main)/sales/page.tsx`, `src/app/(main)/sales/actions.ts` — quick-sell/backfill forms only, not a ledger.

## Architecture / Conventions Observed
- Revenue reporting has one true source (`Sales` table); `Orders` is consulted only for the discount/delivery day-level adjustment, never as a gate on whether a sale counts.
- The "delete-then-reinsert on status change" pattern (`orders/actions.ts` `shouldCreateSales`/`insertSalesRows`/`deleteSalesForOrder`, invoked from `updateOrderStatus`) is the established idempotent way to keep `Sales` in sync with an order's current status.
- DB migrations are additive & idempotent, numbered `NN_name.sql` in `db/`, written in mssql-flavored SQL but hand-translated/applied against the live Postgres DB via a throwaway `pg` node script (as used earlier this session for the shared-stock columns and for the skinner stock inserts) — `db/pg/schema.sql` is a documentation snapshot of the live shape, not itself the deploy mechanism.
- Sidebar active-state elsewhere in the list works only because no other two hrefs share a prefix — there's no existing segment-boundary-safe matching convention to copy; this needs a small fix, not a pattern lookup.

## Related Prior Work (from workflow/)
- `workflow/research/2026-06-21-order-and-stock-sync-audit.md:22,58-61` — first documented "DTF intentionally never creates Sales rows" as a design decision, not flagged as a bug at the time.
- `workflow/research/2026-06-20-dtf-printing-module.md:60-62` — established that `ProductVariants.Qty` is the single stock source of truth read by all dashboards; same "one true table" shape applies to `Sales` for revenue.
- `workflow/plans/2026-06-21-shared-stock-and-dtf-garment-pricing.md` — precedent for a small additive migration + a resolver/sync helper called from the DTF actions file (the shape this fix will follow, but for Sales sync instead of stock resolution).

## Open Questions
1. Should the DTF-sourced `Sales.SellingPrice` be `FinalTotal ?? EstimatedTotal` divided by `Qty` (so `Qty * SellingPrice` reproduces the order total, consistent with how Dashboard/Reports multiply `Qty * SellingPrice`), or should it ignore `Qty` and always treat the DTF order as a single line? (Assumed: divide by `Qty`, for consistency — most DTF orders have `Qty=1` so this is usually moot.)
2. What `SaleDate` should a completed DTF order use — `CreatedAt` (when submitted, consistent with regular orders using `OrderDate` not a status-change time) or "now" at the moment it's marked Completed? (Leaning `CreatedAt` for historical accuracy on charts, but this is a judgment call.)
3. Should a DTF order with `VariantId IS NULL` (no blank chosen) ever produce a Sales row? `Sales.VariantId` is `NOT NULL` in the live schema, so structurally it cannot — this needs an explicit skip/guard, not silent failure.
4. The two already-completed orders (DTF-O-1002, DTF-O-1003) predate any fix — they need a one-time backfill (re-running the new sync logic against their current `Completed` status) to appear retroactively, since the fix only triggers on future `setDtfOrderStatus`/pricing calls.
