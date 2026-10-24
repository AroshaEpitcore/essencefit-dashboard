---
date: 2026-10-24
topic: "How an order flows end-to-end and how every money number (revenue, COGS, discount, delivery, gross/net profit) is computed and stored — assessed against standard retail/e-commerce accounting"
backend_commit: 30bd38e
app_commit: n/a
public_site_commit: n/a
status: complete
tags: [research, orders, sales, finance, reports, item-profit, accounting]
---

# Research: Order process & financial model (essencefit-dashboard)

> Single-repo project (Next.js App Router + Supabase/`pg` + Vercel). The `/research`
> template is written for the 3-repo Maraebiz workspace; adapted here to one repo.
> **Documentarian scope:** this describes what EXISTS today plus an explicit
> "Assessment vs industry" section the user requested. No code was changed.

## Research Question
Document, as-is, how an order flows end to end (admin entry, web orders, DTF
orders, print jobs, returns) and exactly how every money number is computed and
stored — Subtotal, ManualDiscount, DeliverySaving, Discount, DeliveryFee, Total,
Sales.SellingPrice/CostPrice, revenue recognition, COGS, gross vs net profit —
and how discounts/free delivery flow into Dashboard, Finance, Reports, Item
Profit, Analysis. Then assess against standard retail/e-commerce accounting.

## Summary
There is **one revenue ledger — the `Sales` table** — written per order line when
an order becomes Paid/Completed. Every money figure across the app aggregates
`Sales` (gross revenue = Σ Qty×SellingPrice, COGS = Σ Qty×CostPrice) and then
applies order-level adjustments from the `Orders` table (`Discount`,
`DeliveryFee`) joined **by day**.

The model is internally mostly consistent but has **three structural
inconsistencies vs standard accounting**, plus several smaller ones:

1. **Delivery is modelled two opposite ways.** Web checkout treats delivery as a
   real **fee/income** (`DeliveryFee` > 0, added to Total). Admin order entry
   forces `DeliveryFee = 0` and folds any free-delivery "saving" into `Discount`.
2. **The actual courier/delivery COST the business pays is never recorded**
   anywhere (not COGS, not expense). So delivery fees collected (web) inflate net
   profit with no offsetting cost, and admin "free delivery" is booked as a
   notional revenue reduction rather than the real cash cost.
3. **Returns do not reverse revenue or COGS** — `recordReturn` only adds stock
   back. A sold-then-returned item still counts as full revenue + profit.

Additional: discounts are attributed **by day** even though `Sales.OrderId` now
exists (exact per-order attribution is possible); discounts live only at the
order level (per-item profit must estimate); and "profit" is defined slightly
differently on each page (gross tiles vs day-net vs cash).

## Detailed Findings

### The Sales ledger (single source of truth)
- `Sales` rows are the revenue record. For orders they carry `OrderId`,
  `VariantId`, `Qty`, `SellingPrice`, `CostPrice`, `PaymentMethod`
  (`'Order'`/`'DTF'`/`'PrintJob'`/`'cash'`/`'backfill'`), `PaymentStatus`,
  `SaleDate` — `src/app/(main)/orders/actions.ts:514-541` (`insertSalesRows`).
- Sales rows are created **only when the order is Paid/Completed**
  (`shouldCreateSales`, `orders/actions.ts:491-493`); editing/canceling deletes &
  rewrites them (`deleteSalesForOrder`, `:544-548`).
- **Per-unit COGS** is resolved at sale time: the stock/blank variant's
  `CostPrice` (via `fn_StockVariantId`) else the product's, **plus
  `Utilities`**, plus per-unit DTF `PrintCost` for DTF lines —
  `orders/actions.ts:499-512` (`resolveUnitCost`) and `:522-526`. DTF lines are
  tagged `PaymentMethod='DTF'`; plain lines `'Order'`.

### Admin order money model (orders/actions.ts)
- `OrderPayload` money fields (`orders/actions.ts:188-193`):
  `Subtotal`, `ManualDiscount`, `DeliverySaving`, `Discount` *(comment: "includes
  delivery-saving")*, `DeliveryFee` *(comment: "always 0 by your rule")*, `Total`.
- Stored on `Orders` at `:587-594`: `Subtotal`, `ManualDiscount`, `Discount`
  (manual + delivery-saving combined), `DeliveryFee` (0), `Total`.
- So on admin orders **delivery is never a fee** — free delivery is recorded as a
  discount, and `DeliveryFee` is always 0. `DeliverySaving` is passed but NOT
  stored as its own column (only folded into `Discount`), though it can be
  derived as `Discount − ManualDiscount`.

### Web checkout money model (checkout/actions.ts) — OPPOSITE of admin
- Delivery fee computed from province/base, waived to 0 by free-over-value or
  free-by-category rules — `src/app/(shop)/checkout/actions.ts:146-153`.
- `total = subtotal + deliveryFee` — delivery is **added** (customer pays it) —
  `:154`.
- Stored at `:229-233`: `Subtotal=subtotal`, `ManualDiscount=0`, `Discount=0`,
  `DeliveryFee=deliveryFee` (real charge), `Total=subtotal+deliveryFee`.
- Web orders are inserted `PaymentStatus='Pending'` (`:227`) — no `Sales` rows
  until an admin verifies to Paid/Completed.

### DTF orders & Print jobs
- DTF-on-own-garments (`dtf-orders/actions.ts:219-221`): one synced `Sales` row,
  `PaymentMethod='DTF'`, `SellingPrice=charge/unit`, `CostPrice=dtf/unit`
  (blank+utilities+print). Full revenue + cost flow to all pages.
- Admin order DTF lines: per-line print, `PaymentMethod='DTF'`
  (`orders/actions.ts:522-526`).
- Print jobs (`print-jobs/actions.ts`): job-work on the customer's OWN garments,
  DTF cost is pass-through. The synced `Sales` row now carries **profit only**
  (`SellingPrice=profit/unit`, `CostPrice=0`) — `print-jobs/actions.ts` (createPrintJob)
  — so only profit flows to general totals; the full charge/cost live only in the
  `printjobs` table and on the Print Jobs page. Dashboard print-job tiles read
  the `printjobs` table. (See memory `print-jobs-module`.)

### Returns (returns/actions.ts) — restock only
- `recordReturn` inserts `SalesReturns` + `SalesReturnItems` and **adds the qty
  back to stock** (`UPDATE ProductVariants SET Qty = Qty + @Qty`) —
  `src/app/(main)/returns/actions.ts:128-156`.
- It does **not** delete/adjust the original `Sales` rows, nor change the order's
  `PaymentStatus`. So returned units keep counting as sold revenue + profit in
  every report. No refund/credit money figure is recorded.

### How each page computes money
- **Dashboard** (`dashboard/actions.ts:13-81`): `SalesAgg` (GrossSales, Cogs,
  UnitsSold by day) FULL-JOIN `OrdersAgg` (Discount, DeliveryFee by day, Paid/
  Completed only). `ThisMonthSales/AllTimeSales = Σ(GrossSales − Discount +
  DeliveryFee)`; `ThisMonthProfit/AllTimeProfit = Σ((GrossSales − Cogs) −
  Discount + DeliveryFee)`. Dedicated DTF tiles read `Sales` (`:92-115`);
  print-job tiles read the `printjobs` table (`:117-140`).
- **Finance** (`finance/actions.ts:12-59`): `TotalSales = Σ(GrossSales − Discount
  + DeliveryFee)`; `Remaining = TotalSales − Handovers − CashUsage`. **COGS is not
  subtracted** — Finance is a cash/till view, not a profit statement.
  `getProductProfit` (`:67-85`) is gross (Σ SellingPrice − Σ CostPrice), no
  discount allocation.
- **Reports** (`reports/actions.ts`): Sales tab allocates day-level
  `−Discount+DeliveryFee` across products **proportionally by gross share**
  (`runSalesReport:103-186`); P&L nets by day and only applies order adjustments
  when unscoped (`runPnLReport:221-295`). A code comment claims *"Sales table
  doesn't link to OrderId"* (`:97-102`) — but it does (see below).
- **Item Profit** (`item-profit/*`): per-item gross Revenue/Cost/Profit from
  `Sales` (`runItemProfit`). KPI tiles are **gross**. A business-wide **Net
  Profit** line (and per-product estimate column) subtracts
  `−Discount+DeliveryFee` for the period via `getOrderAdjustments`, shown only on
  the unfiltered full period; per-product net is an allocation by sales share.
- **Analysis** (`analysis/actions.ts`): monthly trend `netSales = GrossSales −
  DiscountAmt`, `profit = (GrossSales − Cogs) − DiscountAmt` (`:131-155`);
  `getProductProfit` gross (`:67-85`).

### Revenue recognition & COGS (as implemented)
- **Revenue recognised** when an order is set Paid/Completed (Sales rows appear
  then); web orders sit Pending until verified. `SaleDate = OrderDate`.
- **Gross revenue** = Σ Qty×SellingPrice. **Net revenue** = gross − Discount +
  DeliveryFee (day-joined). **COGS** = Σ Qty×CostPrice (resolved cost +
  utilities + DTF print). **Gross profit** = gross − COGS. **Net profit** = gross
  − COGS − Discount + DeliveryFee.

## Assessment vs standard retail/e-commerce accounting
*(Requested by the user; observations, not yet changes.)*
1. **Delivery treated inconsistently (web = income, admin = discount).** Standard
   practice: shipping charged to the customer is either income or a reduction of a
   shipping-expense; it should be modelled the same way on every channel. Today a
   web order's Rs 400 delivery raises net profit while an admin free-delivery Rs
   300 lowers it, via different columns.
2. **Delivery/courier COST not booked.** Standard: the amount paid to the courier
   is an expense (or shipping COGS). Its absence means collected delivery fees are
   pure profit and "free delivery" is a notional discount, not the real cash cost.
3. **Returns don't reverse revenue/COGS.** Standard: a return reverses the sale
   (contra-revenue) and its COGS (and restocks). Today only stock is restored.
4. **Discounts attributed by day, not by order**, although `Sales.OrderId` is
   populated (`orders/actions.ts:538`) — exact per-order/per-line attribution is
   now possible; the proportional day allocation is a legacy approximation.
5. **Multiple "profit" definitions across pages** (gross tiles vs day-net vs
   cash-only Finance). Standard: one canonical net-profit definition reused.
6. **Discounts stored only at order level, not per line** — fine, but it forces
   the per-item net-profit estimate.
7. **`DeliveryFee` hardcoded 0 on admin orders** — correct only while the owner
   never charges delivery on manual orders.

## Code References
- `src/app/(main)/orders/actions.ts:188-193` — admin OrderPayload money fields (Discount "includes delivery-saving", DeliveryFee "always 0")
- `src/app/(main)/orders/actions.ts:491-548` — Sales create/delete, `resolveUnitCost`, `insertSalesRows` (Sales.OrderId populated at :538)
- `src/app/(main)/orders/actions.ts:587-595` — Orders header insert
- `src/app/(shop)/checkout/actions.ts:146-154` — web delivery fee computation, `total = subtotal + deliveryFee`
- `src/app/(shop)/checkout/actions.ts:229-233` — web Orders insert (DeliveryFee real, Discount 0)
- `src/app/(main)/returns/actions.ts:128-156` — return inserts + restock only (no Sales reversal)
- `src/app/(main)/dashboard/actions.ts:13-140` — dashboard aggregates (day-net sales/profit; DTF from Sales; print jobs from printjobs)
- `src/app/(main)/finance/actions.ts:12-85` — Finance cash view (no COGS) + gross product profit
- `src/app/(main)/reports/actions.ts:97-295` — Sales report (day allocation) + P&L; stale "no OrderId" comment at :97-102
- `src/app/(main)/analysis/actions.ts:131-155` — monthly trend net sales/profit
- `src/app/(main)/item-profit/actions.ts` — per-item gross + `getOrderAdjustments` + `getPrintJobTotals`
- `src/app/(main)/print-jobs/actions.ts` — profit-only synced Sales row
- `src/lib/sqlShim.ts:56-108`, `src/lib/columnCase.ts` — `@param`→`$n` shim + lowercase→PascalCase remap

## Architecture / Conventions Observed
- All financial pages read the `Sales` table and apply `Orders` adjustments —
  there is no separate ledger/journal. `Sales` doubles as both line-items and the
  revenue record.
- Day-join of Sales↔Orders on `CAST(date)` is the recurring adjustment pattern.
- Nullable SQL filter params must be cast (`::uuid`/`::date`/`::text`) — see
  memory `untyped-null-param-42p08`.
- Synthetic Sales rows (DTF, PrintJob, backfill) ride a hidden variant so the
  Sales→Variant→Product→Category joins resolve without touching stock.

## Related Prior Work (from workflow/)
- `workflow/plans/2026-07-18-server-components-render-digest-error.md` — the
  `/web-orders` masked-500 saga (server-action error masking).
- Memories: `print-jobs-module`, `dtf-lines-in-orders`, `category-qty-free-delivery`,
  `sales-cost-unitcost-alias`, `own-first-then-blank-stock`, `untyped-null-param-42p08`.

## Additional findings (deeper sweep)
- **SaleDate basis differs by path.** `createOrder`/`updateOrder` write Sales with
  `SaleDate = OrderDate` (`orders/actions.ts:616,971`), but `updateOrderStatusCore`
  (status→Paid) writes `SaleDate = NOW()` (`:757-759`). The day-join applies
  Orders Discount/DeliveryFee by `OrderDate`. So an order placed in period A but
  marked Paid in period B lands its sales in B and its discount in A → per-period
  profit drifts (business-wide totals still net out across the FULL OUTER JOIN).
  Web orders (created Pending, verified later) are the common trigger.
- **Edit/Delete/Cancel stock + sales handling is sound**: `updateOrder` restores
  old stock via `StockDeducted` then re-deducts + rewrites sales
  (`orders/actions.ts:885-972`); `deleteOrder` restores + cascades
  (`:986-1022`); `updateOrderStatusCore` reconciles stock + rewrites sales on
  Cancel/reactivate (`:749-760`). No double-restore bug observed.
- **`PackagePrintPrice` is label-only** — stored/displayed, never summed into any
  revenue/profit figure (confirmed across the repo). Correct per owner intent
  (it's the courier-label amount, e.g. goods+delivery, for printing only).
- **Admin "Total" is understated on free-delivery orders.** `total = subtotal −
  computedDiscount` where `computedDiscount = manualDiscount + deliverySaving`
  (`orders/page.tsx:857-863`). So giving free delivery reduces the customer's
  Total by the delivery amount — but a free-delivery customer still pays full
  goods price. (Profit nets the same because it's reclassified, but the Total/
  revenue split is wrong.)
- **Admin free-delivery eligibility is hardcoded** `totalQty >= 3` (any items,
  `orders/page.tsx:844`); web uses `freeDeliveryCategoryQty` for a specific
  category. Two different free-delivery rules.
- **`DELIVERY_OPTIONS` hardcoded** `[300,350,400]` in admin entry; Store Settings
  already holds `deliveryFee` + per-province fees (`store-settings/page.tsx:222-290`).
- **Finance/Analysis `getProductProfit` are gross** (no discount), while Item
  Profit offers net — differing per-product profit definitions.

## Target model (owner-confirmed 2026-10-24)
How the owner actually operates (confirmed in this session):
- **Normal delivery order:** customer pays goods + delivery; the courier takes the
  delivery fee (COD), owner pays **no** courier cost. → delivery is **pass-through:
  NOT business income and NOT cost**. Business revenue = goods only. (Today web
  wrongly counts the delivery fee as income.)
- **Free-delivery order:** owner gives free delivery; the courier charges the
  **owner** the delivery fee. → that fee is a real **delivery COST** (expense),
  **separate from discounts**. Business revenue = goods; profit = goods − COGS −
  deliveryCost. (Today it's folded into `Discount` — same profit, wrong class.)
- **Label (`PackagePrintPrice`)** stays view-only (goods or goods+delivery for the
  courier label).
- Same model should apply to **DTF orders** (own items + needful charges; free
  delivery rare but supported). **Keep free-delivery cost and discounts as
  separate, identifiable records in the DB** ("keep all in db").
- **Returns** reverse the sale's revenue + COGS and restock (owner chose this).
- **Delivery treatment unified as a fee everywhere**, driven by Store Settings;
  free delivery = fee 0 to the customer + a recorded delivery cost to the owner.

Net effect on numbers: reclassifying admin free-delivery from Discount→DeliveryCost
is **profit-neutral** (same bottom line, cleaner split). Removing customer-paid
delivery from web **income is a correction** that will **reduce** reported web
revenue/profit by those pass-through fees (they were never the owner's money).

## Open Questions
- Is there any existing refund/credit-note concept, or is a return purely a
  restock? (None found in `returns/actions.ts`.)
- Does the business actually pay couriers a fee per delivery (so a shipping-cost
  line is warranted), and should free delivery reduce revenue or book a cost?
- Should web `DeliveryFee` income and admin `DeliverySaving` discount be unified
  into one canonical delivery treatment across channels?
- Should discount attribution move from day-level to `Sales.OrderId`-level now
  that the link exists?
