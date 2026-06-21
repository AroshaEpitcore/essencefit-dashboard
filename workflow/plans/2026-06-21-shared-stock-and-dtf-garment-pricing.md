---
date: 2026-06-21
slug: shared-stock-and-dtf-garment-pricing
status: implementing
surfaces: [storefront, admin, db]
research: workflow/research/2026-06-21-shared-stock-and-dtf-garment-pricing.md
estimated_manual_effort: 2h 20m
---

# Shared Stock & DTF Garment Pricing — Implementation Plan

## Overview
Let any product draw its stock from a shared "blank" product so the same physical garment can be sold as multiple products (plain, signature, branded like "Hurley Short", and the DTF blank) from **one stock pool**; price DTF garments from the blank's **cost + a per-product DTF profit** instead of retail; and flag/badge **print-on-demand** products through to Website Orders.

## Estimated Manual Effort
**2h 20m** — total human-in-the-loop time only (reviewing each phase + manual verification at each pause + final `/validate`), with a 10% buffer. Claude Code implements; no dev hours counted.

## Current State
- Stock is per-product: a `ProductVariant(ProductId, SizeId, ColorId, Qty, CostPrice, SellingPrice)` holds its own `Qty`; no link between products (research §Data model). Only manual `transferStock` moves qty across products (`src/app/(main)/stocks/actions.ts:221`).
- Stock reads everywhere use the product's own variants: storefront `PRODUCT_SELECT` Stock + `attachColors` InStock + `getProductVariants` (`src/lib/storefront.ts`), `getVariant`/`getVariantStockByProductAndSize` (`src/app/(main)/orders/actions.ts:63,85`), catalog Stock (`src/app/(main)/catalog/actions.ts:39`).
- Stock writes use the ordered variant id directly: `checkout/actions.ts:181`, `orders/actions.ts:263,281`, `dtf-orders/actions.ts` (confirm/cancel).
- DTF garment price = retail `SellingPrice` (`src/app/(shop)/customize/actions.ts:55-60`); estimate adds a single global profit (`src/lib/dtfPricing.ts:36,88`).
- Products have `CostPrice` + `SellingPrice`; flags `IsActive/IsFeatured/IsNewArrival/IsDtfPrintable` set via catalog (`src/app/(main)/catalog/actions.ts`). Web orders listed by `getWebOrders` (`src/app/(main)/web-orders/actions.ts:6`).

## Desired End State
- A product can be linked to a **blank** (`BlankProductId`). Linked products show and decrement the **blank's** stock (matched by Size+Colour); unlinked products behave exactly as today.
- Selling a linked product through the **normal cart/checkout** (and admin orders, and DTF) adjusts the **blank** pool — visible consistently in Inventory/Stocks/Sales.
- DTF estimate garment base = **blank `CostPrice` + DtfProfit** (per-product, default global), not retail.
- Admin can, per product: pick a stock-source blank, set a DTF profit, and tick **print-on-demand**; linked products auto-get size/colour variants mirroring the blank.
- **Website Orders** shows a **print-on-demand** badge on orders containing such products.
- Works for **any** product/category, not just tees/shorts.

## What We're NOT Doing
- Not merging products into one page/tier (we keep separate products linked by blank).
- Not auto-syncing later blank changes beyond the link/save action (a "re-sync variants" happens on catalog save; adding a new colour to the blank later needs re-saving the linked product).
- Not changing profit reporting math (cost-based margin already works; it now reads the blank's cost via the shared variant).
- No multi-level blanks (a blank cannot itself be linked to another blank).
- No app/public-site (none in repo).

## Touchpoints per surface
- **DB**: `db/18_shared_stock.sql` — `Products.BlankProductId`, `Products.DtfProfit`, `Products.PrintOnDemand`; scalar fn `dbo.fn_StockVariantId(@VariantId)`.
- **Storefront reads**: `src/lib/storefront.ts` (`PRODUCT_SELECT` Stock, `attachColors`, `getProductVariants`, add `CostPrice` to `StoreVariant`, `getDtfPrintableProducts`/`getDtfGarment` expose cost + DtfProfit).
- **Stock writes**: `src/app/(shop)/checkout/actions.ts`, `src/app/(main)/orders/actions.ts`, `src/app/(main)/dtf-orders/actions.ts`.
- **DTF pricing**: `src/lib/dtfPricing.ts`, `src/app/(shop)/customize/actions.ts`, `src/app/(shop)/customize/CustomizeForm.tsx`, `src/app/(shop)/customize/page.tsx`.
- **Admin**: `src/app/(main)/catalog/actions.ts` + `page.tsx` (blank link, DtfProfit, print-on-demand, variant sync); `src/app/(main)/web-orders/actions.ts` + `page.tsx` (badge); `src/app/(main)/orders/actions.ts` reads.
- **Tenancy**: single-tenant — n/a.

---

## Phase 1: DB — blank link, DTF profit, print-on-demand, stock-resolver fn
### Changes
#### `db/18_shared_stock.sql` (idempotent; apply with the throwaway `mssql` node script)
```sql
IF COL_LENGTH('Products','BlankProductId') IS NULL
  ALTER TABLE Products ADD BlankProductId UNIQUEIDENTIFIER NULL;
IF COL_LENGTH('Products','DtfProfit') IS NULL
  ALTER TABLE Products ADD DtfProfit DECIMAL(10,2) NULL;
IF COL_LENGTH('Products','PrintOnDemand') IS NULL
  ALTER TABLE Products ADD PrintOnDemand BIT NOT NULL CONSTRAINT DF_Products_PrintOnDemand DEFAULT 0;
GO
CREATE OR ALTER FUNCTION dbo.fn_StockVariantId(@VariantId UNIQUEIDENTIFIER)
RETURNS UNIQUEIDENTIFIER AS
BEGIN
  DECLARE @Res UNIQUEIDENTIFIER = @VariantId, @Blank UNIQUEIDENTIFIER,
          @Size UNIQUEIDENTIFIER, @Color UNIQUEIDENTIFIER;
  SELECT @Blank = p.BlankProductId, @Size = v.SizeId, @Color = v.ColorId
  FROM ProductVariants v JOIN Products p ON p.Id = v.ProductId
  WHERE v.Id = @VariantId;
  IF @Blank IS NOT NULL
  BEGIN
    SELECT TOP 1 @Res = b.Id FROM ProductVariants b
    WHERE b.ProductId = @Blank
      AND ISNULL(CONVERT(NVARCHAR(36), b.SizeId), '') = ISNULL(CONVERT(NVARCHAR(36), @Size), '')
      AND ISNULL(CONVERT(NVARCHAR(36), b.ColorId), '') = ISNULL(CONVERT(NVARCHAR(36), @Color), '');
    IF @Res IS NULL SET @Res = @VariantId; -- blank has no matching variant yet
  END
  RETURN @Res;
END
GO
```
### Success Criteria
#### Automated
- [x] Migration applies (script prints the 3 new column lengths and `fn_StockVariantId` exists; re-runs clean).
- [x] App builds: `npm run build`
#### Manual
- [ ] `SELECT dbo.fn_StockVariantId('<a normal variant id>')` returns the same id; for a (temporarily) linked product's variant it returns the blank's matching variant id.

**Pause here** for confirmation.

---

## Phase 2: Stock reads resolve to the blank
### Changes
#### `src/lib/storefront.ts`
- `PRODUCT_SELECT` Stock subquery → the blank's pool: `ISNULL((SELECT SUM(b.Qty) FROM ProductVariants b WHERE b.ProductId = ISNULL(p.BlankProductId, p.Id)), 0) AS Stock`.
- `attachColors` InStock per colour → resolve each variant via the fn: `MAX(CASE WHEN (SELECT Qty FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(v.Id)) > 0 THEN 1 ELSE 0 END) AS InStock` (and use the resolved qty for image/sort unaffected).
- `getProductVariants` → return resolved qty + cost: `(SELECT Qty FROM ProductVariants z WHERE z.Id=dbo.fn_StockVariantId(v.Id)) AS Qty`, and add `(SELECT ISNULL(CostPrice,0) FROM ProductVariants z WHERE z.Id=dbo.fn_StockVariantId(v.Id)) AS CostPrice`. Add `CostPrice` to the `StoreVariant` type.
#### `src/app/(main)/orders/actions.ts`
- `getVariant`, `getVariantStockByProductAndSize` → read qty from `dbo.fn_StockVariantId(v.Id)` so the admin order form shows shared stock.
#### `src/app/(main)/catalog/actions.ts`
- `getCatalogProducts` Stock → `ISNULL((SELECT SUM(b.Qty) FROM ProductVariants b WHERE b.ProductId = ISNULL(p.BlankProductId, p.Id)), 0)`.
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] After linking a product to a stocked blank (temporary manual `UPDATE` for testing, or via Phase 5), the linked product's PDP and catalog row show the **blank's** stock and per-colour availability.

**Pause here** for confirmation.

---

## Phase 3: Stock decrement / restore through the blank
### Changes
- **Checkout** `src/app/(shop)/checkout/actions.ts`: the availability re-read and `UPDATE ProductVariants SET Qty = Qty - @Qty` target `dbo.fn_StockVariantId(@VariantId)` (read + write). 
- **Admin orders** `src/app/(main)/orders/actions.ts`: `validateAndReduceStock` reads/updates via `dbo.fn_StockVariantId`; `restoreStockFromOrder` restores to the resolved variant — `UPDATE v SET v.Qty=v.Qty+oi.Qty FROM ProductVariants v JOIN OrderItems oi ON v.Id = dbo.fn_StockVariantId(oi.VariantId) WHERE oi.OrderId=@OrderId`.
- **DTF** `src/app/(main)/dtf-orders/actions.ts`: `confirmDtfOrder`/`setDtfOrderStatus` read the variant qty and decrement/restore via `dbo.fn_StockVariantId(o.VariantId)`; the `StockHistory` row logs against the resolved (blank) variant.
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] Placing a normal web order for a linked product reduces the **blank**'s variant Qty (verify in `/stocks` + `/stock-history`); editing/deleting that order restores it.
- [ ] A second linked product sharing the same blank sees the reduced stock immediately.
- [ ] DTF confirm/cancel on a linked product moves the blank's stock; an unlinked product still moves its own stock (no regression).

**Pause here** for confirmation.

---

## Phase 4: DTF garment price = blank cost + DTF profit
### Changes
#### `src/lib/dtfPricing.ts`
- `computeDtfEstimate({ garmentCost, printNames, qty, profitOverride })`: `profit = profitOverride ?? globalProfit`; `perPiece = garmentCost + Σ(prints) + overheadTotal + profit`; `total = perPiece*qty + orderExtra`. (Garment base is now **cost**, and profit is the garment margin — no double-count.) Keep `getDtfPricingConfig` returning `{ prints, overheadTotal, profit (global), orderExtra }`.
#### `src/lib/storefront.ts`
- `getDtfPrintableProducts`/`getDtfGarment` expose, per product, `CostPrice` (the product's, used as fallback) and `DtfProfit`; variants already carry resolved `CostPrice` (Phase 2). DTF garment cost = chosen variant's resolved `CostPrice` (blank cost) ?? product `CostPrice`.
#### `src/app/(shop)/customize/actions.ts`
- `createDtfOrder`: `garmentCost = variant.CostPrice ?? product.CostPrice`; `profitOverride = product.DtfProfit ?? null`; call `computeDtfEstimate({ garmentCost, printNames, qty, profitOverride })`. Persist breakdown as today.
#### `src/app/(shop)/customize/CustomizeForm.tsx` + `page.tsx`
- Live estimate uses the selected variant's cost + the product's DtfProfit (passed from the page) + the pricing config; mirror the new formula.
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] For a DTF-printable product with blank cost 750 and DtfProfit 500, the customize estimate shows garment portion ≈ 1250 (+ prints/overheads), not the retail 1590; changing DtfProfit (Phase 5) or the global profit changes it.

**Pause here** for confirmation.

---

## Phase 5: Catalog admin — link blank, DTF profit, print-on-demand, variant sync
### Changes
#### `src/app/(main)/catalog/actions.ts`
- Add `BlankProductId`, `DtfProfit`, `PrintOnDemand` to `CatalogProduct`, `getProductForEdit`, and `ProductStorefrontInput`/`updateProductStorefront` (SELECT + UPDATE).
- `getBlankCandidates()` → products eligible as a blank: `WHERE BlankProductId IS NULL AND Id <> @self` (a blank can't be linked itself).
- On save with a `BlankProductId`: **sync variants** — for each blank variant `(SizeId,ColorId)` without a matching variant on the linked product, INSERT a linked variant (Qty 0, the linked product's Cost/Selling) so the storefront shows options. (Existing linked variants keep their price.)
#### `src/app/(main)/catalog/page.tsx`
- Edit modal: a **"Stock source (blank)"** select (from `getBlankCandidates`, with "— none —"), a **"DTF profit (Rs)"** number input (placeholder = global default), and a **"Print on demand"** checkbox. Show a small "linked → <blank>" hint in the row when set.
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] Create a "Plain Short" blank (stocked) + a "Hurley Beach Short" product (Rs 990); in catalog set Hurley's stock source = Plain Short and tick print-on-demand → Hurley auto-shows the plain short's sizes/colours and stock; ordering Hurley via normal cart reduces the plain short pool.
- [ ] Setting a per-product DTF profit overrides the global for that product's DTF estimate.

**Pause here** for confirmation.

---

## Phase 6: Print-on-demand badge on Website Orders
### Changes
#### `src/app/(main)/web-orders/actions.ts`
- `getWebOrders`: add `CAST(CASE WHEN EXISTS (SELECT 1 FROM OrderItems oi JOIN ProductVariants v ON v.Id=oi.VariantId JOIN Products p ON p.Id=v.ProductId WHERE oi.OrderId=o.Id AND p.PrintOnDemand=1) THEN 1 ELSE 0 END AS BIT) AS HasPrintOnDemand`.
#### `src/app/(main)/web-orders/page.tsx`
- Show a **"Print on demand"** badge on rows where `HasPrintOnDemand` (so paid orders needing printing/branding before dispatch are obvious).
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] A web order containing a print-on-demand product shows the badge in `/web-orders`; an order without one does not.

**Pause here**, then run `/validate shared-stock-and-dtf-garment-pricing`.

## Testing Strategy
No automated tests. Gate per phase = `npm run build` (+ the one-off migration in Phase 1). End-to-end: (1) stock a "Plain Short" blank; (2) link "Hurley Short" (990) + "Signature/plain tee" examples; (3) verify linked PDPs show the blank's stock; (4) place a normal web order for a linked product → blank pool drops, history logged; (5) DTF estimate on a printable product uses blank cost + DtfProfit; (6) web-orders shows the print-on-demand badge. Verify an **unlinked** product is unchanged throughout (regression).

## References
- Research: `workflow/research/2026-06-21-shared-stock-and-dtf-garment-pricing.md`
- Stock reads: `src/lib/storefront.ts` (`PRODUCT_SELECT`, `attachColors`, `getProductVariants`), `src/app/(main)/orders/actions.ts:63,85`, `src/app/(main)/catalog/actions.ts:39`
- Stock writes: `src/app/(shop)/checkout/actions.ts:181`, `src/app/(main)/orders/actions.ts:263,281`, `src/app/(main)/dtf-orders/actions.ts`
- DTF pricing: `src/lib/dtfPricing.ts`, `src/app/(shop)/customize/actions.ts:55`
- Flag/CRUD pattern: `src/app/(main)/catalog/actions.ts` + `page.tsx` (IsDtfPrintable)
- Web orders: `src/app/(main)/web-orders/actions.ts:6` + `page.tsx`
- Industry standard considered: this mirrors a lightweight "bundle/kit shares component stock" / shared-SKU pattern; full systems use a dedicated inventory-item entity, but a `BlankProductId` resolver fits this repo's per-variant model with minimal churn and no new tables. (n/a external lib.)
