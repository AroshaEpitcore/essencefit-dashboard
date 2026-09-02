# Manual Order & Stock Entry Guide

How we record WhatsApp / walk-in sales, DTF print orders, exchanges, and stock
removals directly in the production database. There is **no admin UI** for most
of this, so entries are made by small SQL scripts against the DB.

> Connect with `DIRECT_URL` from `.env.local` (Supabase session pooler).
> Single reads / one-off inserts are fine. **Never** run many-connection or
> load-test scripts against this DB — it's the live production DB and will
> exhaust the pooler (causes intermittent 500s).

---

## The money model (how cost & profit are figured)

**Profit = Revenue − Cost.** Everything hinges on getting *Cost* right.

Cost of one garment sold:

| Piece | Where it comes from |
|---|---|
| **Blank cost** | the product's `CostPrice` — real money paid to buy the plain garment. **Always counted** (the garment is never free). |
| **Print** (DTF only) | **per shirt** — e.g. "print 400" means 400 for *each* shirt, not the order. |
| **Utilities / overhead** | stated **per order** *or* per shirt — always confirm which. If per order, spread it evenly across the shirts. |

So for a printed shirt:  `unit cost = blank CostPrice + print-per-shirt + utilities share`

> ⚠️ The two easy mistakes: (1) forgetting the blank cost, (2) treating print as
> a whole-order charge when it's **per shirt**.

### Blank costs (as of 2026-08-07 — verify from `ProductVariants.CostPrice`)

Cost is tracked **per variant** now, so a size/colour can differ from the product
default after a restock at a new price.

| Product | Blank cost | List sell | Notes |
|---|---|---|---|
| Oversized T-Shirt | **830** (was 750) | 1590 | new stock @830 — see per-size table below |
| Regular T-Shirt | 850 | 1590 | |
| Plain Skinner | 900 | 1590 | product has 150 utilities built in |
| Ck Sport short | 550 | 990 | |
| Ceylon Short | 750 | 1290 | |
| Regular Black Polo Collar T-Shirt | 1050 | 1650 | |
| Signature Collection T Shirt | 1000 | 1990 | |

#### Oversized T-Shirt — per-size blank cost

Restocked the Black collection on **2026-08-07** at a new blank cost of **830**
(previous stock was **750**). We sell the new t-shirts, so **use 830** for any
Black Large / XL / XXL going forward. Untouched variants stay at the old 750.

| Variant | Blank cost | Comment |
|---|---|---|
| Large / Black | **830** | restocked +20 on 2026-08-07 @830 (use 830) — old stock was 750 |
| XL / Black | **830** | restocked +20 on 2026-08-07 @830 (use 830) — old stock was 750 |
| XXL / Black | **830** | new size, 6 pcs added 2026-08-07 @830 |
| Medium / Black | 750 | not restocked — still old stock @750 |
| Large / White | 750 | not restocked — still old stock @750 |
| Medium / White | 750 | not restocked — still old stock @750 |
| XL / White | 750 | not restocked — still old stock @750 |

---

## Where sales are stored

The `Sales` table is the single source of truth for Dashboard / Reports /
Finance. Key columns:

- `VariantId` — the exact size+colour variant sold
- `Qty` — units on this line
- `SellingPrice` — **per unit** (not the line total)
- `CostPrice` — **per unit**
- `PaymentMethod` — `'cash'` for plain sales, `'DTF'` for print orders
- `PaymentStatus` — `'Paid'` (cash) / `'Completed'` (DTF)
- `SaleDate`

Reports multiply `SellingPrice × Qty` and `CostPrice × Qty`, so always store
**per-unit** figures.

**One `Sales` row per variant.** An order with several sizes/colours = several
rows. Selling also requires reducing stock:
`UPDATE ProductVariants SET Qty = Qty - <n> WHERE Id = <variant>`.

---

## Recipe 1 — Plain garment sale (no print)

Example: *Plain Skinner XL/White, sold 1590.*

1. Find the variant (`ProductVariants` joined to `Products`/`Sizes`/`Colors`).
2. Cost = variant `CostPrice` **+ product `Utilities`** (Plain Skinner has 150 built in → cost 1050).
3. Insert one `Sales` row: `Qty`, `SellingPrice` (per unit), `CostPrice` (per unit), `'cash'`, `'Paid'`.
4. Deduct stock by the qty sold.

Profit = (SellingPrice − CostPrice) × Qty. (1590 − 1050 = **540**.)

---

## Recipe 2 — DTF print sale (printed garment)

Example: *Black Polo — XXL×1, XL×2, Large×3, sold 2000 each, print 400/shirt.*

Per shirt cost = blank 1050 + print 400 = **1450**.

1. For **each** size/colour: one `Sales` row with `Qty`, `SellingPrice` per unit,
   `CostPrice` per unit (= blank + print + utilities share), `'DTF'`, `'Completed'`.
2. Deduct that size's stock.
3. If utilities are "per order", spread them evenly across all units
   (e.g. 300 over 4 shirts = 75/shirt). If it doesn't divide evenly, load the
   remainder onto one line so the **order totals stay exact**.

Worked example (Oversized Large, 4 tees, 1900 each, print 350/shirt, utilities 300/order):

```
unit cost = 750 blank + 350 print + (300/4=75 utils) = 1175
revenue = 4 × 1900 = 7600
cost    = 4 × 1175 = 4700
profit  = 2900
```

### Also add a `DtfOrders` header row (so it shows on `/dtf-orders`)

The `/dtf-orders` admin page **only lists rows from the `DtfOrders` table** — it
does not read `Sales`. So a DTF order recorded as `Sales` rows alone is invisible
there (and unsearchable), even though it counts in Dashboard/Reports/Finance.
**Always add a header row so the order appears on that page.**

Header fields: `Ref` = `DTF-O-<max+1>` (get the max from
`SELECT max(CAST(substring(ref from 7) AS int)) FROM dtforders WHERE ref ~ '^DTF-O-[0-9]+$'`),
`CustomerName`, `CustomerPhone` `'N/A'`, `Qty`, `EstimatedTotal` = cost,
`FinalTotal` = sold, `Status` `'Completed'`, `StockDeducted` true, `AdminNote`
describing the manual entry.

- **Single-variant order:** set `ProductId` + `VariantId` to the sold variant, and
  set the `Sales` row's `DtfOrderId` to this header's id (linked), like DTF-O-1014.
- **Multi-size / multi-variant order (e.g. DTF-O-1040):** set `ProductId` for
  display but leave **`VariantId` NULL**, and leave the `Sales` rows' `DtfOrderId`
  **NULL** (unlinked). This makes the header a display/traceability row only.
  ⚠️ Do **not** link multi-variant `Sales` rows to one header: the admin page's
  status/pricing actions re-sync `Sales` from the header
  (`DELETE FROM Sales WHERE DtfOrderId=@Id` then re-insert **one** row from the
  header's single variant), which would wipe your real per-variant rows and
  double-count. A NULL `VariantId` makes the header inert to that sync.

---

## Recipe 3 — Exchange (swap, no money)

Example: *Customer returns Lavender + Olive Blue XL, takes Navy Blue + Black XL — even swap.*

An even swap = **stock movement only, no `Sales` rows, no revenue/profit.**

- Items given to the customer → `Qty = Qty - 1` (out)
- Items returned by the customer → `Qty = Qty + 1` (in, back to sellable stock)

If the swap is uneven (customer pays the difference), record the paid portion as
a normal sale and adjust the rest as stock. Confirm direction before running —
inventory that was 0 can only be coming *in*, which is a good sanity check.

---

## Recipe 4 — Stock removal / adjustment (not a sale)

Example: *Remove 4 of each black polo size (damaged / correction).*

Not a sale → no `Sales` row, no revenue. Instead:

1. `UPDATE ProductVariants SET Qty = Qty - <n>` (guard with `AND Qty >= <n>`).
2. Log it for audit — insert into `StockHistory`:
   `(VariantId, ChangeQty negative, Reason 'stock-remove', PreviousQty, NewQty, PriceAtChange, CreatedAt)`.

(Plain sales/DTF sales do **not** write StockHistory — only stock add/remove adjustments do.)

---

## Script skeleton

Every entry uses the same shape — run one transaction, print the result:

```js
import { readFileSync } from "node:fs";
import pg from "pg";
const env = readFileSync("C:/essencefit-dashboard/.env.local", "utf8");
const client = new pg.Client({ connectionString: env.match(/DIRECT_URL="([^"]+)"/)[1] });

await client.connect();
try {
  await client.query("BEGIN");
  // 1. look up variant(s)
  // 2. INSERT INTO Sales (...) / UPDATE ProductVariants (...) / INSERT INTO StockHistory (...)
  // 3. deduct or restore stock (guarded: AND Qty >= n)
  await client.query("COMMIT");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("ROLLED BACK:", e.message);
} finally { await client.end(); }
```

Run it from the **project root** (so `pg` resolves), then delete the temp file.

---

## Quick checklist before recording

- [ ] Is it a **sale**, **exchange**, or **stock removal**? (Different recipes.)
- [ ] Blank cost included?
- [ ] Print **per shirt**? Utilities per order or per shirt?
- [ ] `SellingPrice` / `CostPrice` stored **per unit**, not line totals?
- [ ] One `Sales` row per size/colour variant?
- [ ] **DTF order:** `DtfOrders` header row added so it shows on `/dtf-orders`? (multi-variant → `VariantId` NULL, `Sales` unlinked)
- [ ] Stock deducted (sale) / restored (return) / logged (removal)?
- [ ] Totals sanity-checked (revenue − cost = profit, and profit isn't negative)?
