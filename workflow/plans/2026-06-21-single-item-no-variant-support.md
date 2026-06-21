---
date: 2026-06-21
slug: single-item-no-variant-support
status: implementing
surfaces: [admin]
research: workflow/research/2026-06-21-single-item-no-variant-support.md
estimated_manual_effort: 1h
---

# Single / One-Off Item Support — Implementation Plan

## Overview
Let the admin sell **one-off items** (caps, accessories, unique pieces — "one of each", no size/colour) without the dummy "One Size/Default" workaround. Add a **"Single item (one-off)"** toggle when creating a product in Stocks that auto-creates **one variant with no size/colour** and a starting quantity, and make those attribute-less variants **visible in the Stocks list**. No DB change is needed (the columns are already nullable) and the storefront/checkout already handle null size/colour.

## Estimated Manual Effort
**1h** — human review per phase + manual verification at each pause + final `/validate`, with a 10% buffer.

## Current State
- Selling is variant-based; a product with **no `ProductVariants` row has 0 stock → "Sold out"** (confirmed: "Premium Caps (IMPORTED)" has 0 variants). Research §Summary.
- DB already supports attribute-less variants: `ProductVariants.SizeId`/`ColorId` are **nullable**, and 3 such rows already exist.
- Storefront already tolerates null size/colour end-to-end: `getProductVariants` LEFT JOINs (`src/lib/storefront.ts:339-340`); `AddToCart` derives `hasSizes`/`hasColors` and shows a single buyable variant with no pickers (`src/components/shop/AddToCart.tsx:58-119`); `fn_StockVariantId` matches with `ISNULL` (`db/18_shared_stock.sql:33-35`).
- Blockers (admin only): product creation makes **no variant** (`addProduct`, `src/app/(main)/stocks/actions.ts:71-82`); Quick Stock **requires** size+colour (`stocks/page.tsx:210`); the Stocks list **INNER JOINs** Sizes/Colors so attribute-less rows are hidden (`stocks/actions.ts:211-212`).

## Desired End State
- In **Stocks → Create Products**, ticking **"Single item (one-off)"** and entering a Qty creates the product **and** one `ProductVariants` row (SizeId NULL, ColorId NULL, Qty, cost, selling) in one step, logging a `StockHistory` "stock-add" row.
- That one-off appears in the **Current Stock Items** list with "—" for size/colour and its Qty.
- After the admin publishes it in Catalog (active + slug + image, as for any product), it shows on the storefront as buyable with **no size/colour pickers**; buying it decrements the single variant; at Qty 0 it shows "Sold out".
- Normal multi-variant products and the Quick Stock flow are unchanged.

## What We're NOT Doing
- Not adding "No size/No colour" options to **Quick Stock** (the chosen UX is the create-time toggle). Restocking a one-off later via Quick Stock is therefore out of scope; qty for one-offs is set at creation. (If needed later, that's the "Both" option.)
- Not changing **Inventory / WhatsApp / Dashboard / Analysis / Sales / Returns / admin order builder** — they keep their `INNER JOIN`s, so one-off items won't appear in those size/colour breakdowns (accepted: "Stocks only" scope).
- No DB/schema change (columns already nullable).
- No storefront code change (already handles attribute-less variants).

## Touchpoints per surface
- **Admin (Stocks)**: `src/app/(main)/stocks/actions.ts` (`addProduct` → optional one-off variant; `getStockItems` LEFT JOIN), `src/app/(main)/stocks/page.tsx` (toggle + qty in the Create Products form; "—" rendering).
- **Tenancy**: single-tenant — n/a.
- **DB / storefront / app**: none.

---

## Phase 1: "Single item (one-off)" toggle creates a no-variant stock row
### Changes
#### `src/app/(main)/stocks/actions.ts`
- `addProduct(categoryId, name, cost, sell, oneOff?: boolean, qty?: number)`:
  - Insert the product with `OUTPUT Inserted.Id` to capture the new product id.
  - If `oneOff`: insert one `ProductVariants (ProductId, SizeId, ColorId, Qty, CostPrice, SellingPrice)` with **SizeId = NULL, ColorId = NULL**, `Qty = Math.max(0, qty ?? 0)`, cost/sell from the product; then insert a `StockHistory` row `(VariantId, ChangeQty=qty, Reason='stock-add', PreviousQty=0, NewQty=qty, PriceAtChange=sell, GETDATE())` (mirrors `quickStock` logging at `:187-190`).
  - Keep the existing non-one-off behavior (product only, no variant) unchanged.
#### `src/app/(main)/stocks/page.tsx`
- In the Create Products form (`:626-651`): add a **"Single item (one-off)"** checkbox and, when ticked, a **Qty** input. `handleAddProduct` passes `oneOff`/`qty` to `addProduct`. Reset both after add.
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] Creating a product with the toggle on + Qty 1 makes a product with exactly one variant (`SizeId/ColorId` NULL, `Qty=1`) and a `stock-add` row in `/stock-history`.
- [ ] Creating a product with the toggle **off** behaves as before (no variant).

**Pause here** for confirmation.

---

## Phase 2: Show one-off (attribute-less) variants in the Stocks list
### Changes
#### `src/app/(main)/stocks/actions.ts`
- `getStockItems`: change `INNER JOIN Sizes s` / `INNER JOIN Colors c` (`:211-212`) to `LEFT JOIN`, and return a display fallback (e.g. `ISNULL(s.Name, '—') AS SizeName`, `ISNULL(c.Name, '—') AS ColorName`) so attribute-less rows appear.
#### `src/app/(main)/stocks/page.tsx`
- Stock Items table already renders `item.SizeName` / `item.ColorName` (`:1198-1199`); with the fallback they show "—". (No change needed beyond confirming the fallback; optionally render "—" when empty.)
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] The one-off product appears in **Current Stock Items** with "—" size/colour and the correct Qty; its price bulk-edit still works.
- [ ] Existing multi-variant rows are unchanged (no duplicates/missing rows).

**Pause here** for confirmation.

---

## Phase 3: Make an EXISTING product a one-off (added during implementation)
Added because already-created products (e.g. "Premium Caps (IMPORTED)" — active, 20 images, 0 variants) can't use the create-time toggle and shouldn't be deleted/recreated.
### Changes
#### `src/app/(main)/stocks/actions.ts`
- `getProductsByCategory`: also return `(SELECT COUNT(*) FROM ProductVariants v WHERE v.ProductId=p.Id) AS Variants` so the UI can offer the action only for variant-less products.
- New `addOneOffStock(productId, qty)`: create the product's no-size/no-colour variant if missing (using the product's cost/selling), else increment its Qty; log a `StockHistory` "stock-add" row. (Idempotent: one null/null variant per product.)
#### `src/app/(main)/stocks/page.tsx`
- In the Create Products table, for rows with `Variants === 0`, show a small **Qty input + "Add one-off stock"** action that calls `addOneOffStock` and refreshes.
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] On "Premium Caps (IMPORTED)" (0 variants), entering Qty + "Add one-off stock" creates one null/null variant with that Qty, a `stock-add` history row, and the action disappears (now 1 variant).
- [ ] The cap then shows in stock and is buyable on the storefront (no pickers).

**Pause here**, then run `/validate single-item-no-variant-support`.

## Testing Strategy
No automated tests. Gate per phase = `npm run build`. End-to-end: (1) Stocks → add a cap with "Single item (one-off)" + Qty 1 → variant created + `stock-add` history; (2) it shows in the Stocks list with "—"; (3) publish it in Catalog (set active + slug + image); (4) storefront product page shows it buyable with **no** size/colour pickers; (5) add to cart + checkout → stock → 0, then it reads "Sold out"; (6) confirm a normal multi-variant product (e.g. a tee) is unchanged in Stocks and on the storefront (regression).

## References
- Research: `workflow/research/2026-06-21-single-item-no-variant-support.md`
- Product/variant creation: `src/app/(main)/stocks/actions.ts:71-82,123-146` (`addProduct`, `quickStock` logging pattern at `:187-190`)
- Stocks list INNER JOINs: `src/app/(main)/stocks/actions.ts:200-213`
- Create Products form: `src/app/(main)/stocks/page.tsx:601-716`
- Storefront null-tolerance (no change): `src/components/shop/AddToCart.tsx:58-119`, `src/lib/storefront.ts:339-340`
- Resolver: `db/18_shared_stock.sql:24-39`
- Industry standard considered: products with no variation are normally a "default/implicit variant" (e.g. one SKU, no options); this models that as a single null-attribute `ProductVariants` row rather than forcing dummy size/colour lookups — consistent with the existing variant-per-sell-unit design. (n/a external lib.)
