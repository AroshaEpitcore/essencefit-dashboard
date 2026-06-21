---
date: 2026-06-21
topic: "Product modelling for shared stock across plain/signature/DTF, and DTF garment pricing as cost+profit instead of retail"
repo_commit: c15a1ff
status: complete
tags: [research, products, variants, stock, pricing, dtf, catalog]
---

# Research: Shared Stock & DTF Garment Pricing

> Single-repo **essencefit-dashboard** (Next.js 16 + MSSQL). Sections adapted to this codebase.

## Research Question
The owner sells one physical blank (e.g. Oversized Tee, black/white, M–XL, under "T-Shirts") three ways from **one stock pool**: as a **plain** product (Rs 1590), as a **"signature collection"** product (Rs 1890, actually printed only after a website order, using the same blank), and as the **blank used for DTF custom printing**. Retail prices are set directly per product, but the blank's real cost is ~Rs 750; when a product is used for **DTF**, the garment component of the estimate should be **cost + a profit (e.g. 500, editable)** — not the retail selling price. How do Products/ProductVariants/stock, the catalog, and the DTF estimate model price & stock today, and what's missing to support this cleanly for any product?

## Summary
- **Stock is per-product, not shared.** A `ProductVariant` is keyed by `(ProductId, SizeId, ColorId)` and holds its own `Qty`. Two products (plain tee, signature tee) have **independent** variant rows and **independent** stock. There is **no** "blank/parent/group" concept linking products to one stock pool (confirmed: no `ParentProductId`/`BlankProductId`/`GroupId`/shared-stock anywhere in `src`/`db`).
- The only cross-product stock movement today is the admin **`transferStock`** (manual move of qty from one product's variant to another's) — not an automatic shared pool.
- **Every sellable thing is a `Product` with its own price.** `Products` and `ProductVariants` each carry **both** `CostPrice` and `SellingPrice`. So a product can already have retail `SellingPrice` (1590/1890) and a true `CostPrice` (750); profit reports use `CostPrice`.
- **DTF garment price = the product's retail `SellingPrice`, not cost+profit.** `createDtfOrder` sets `garmentPrice = variant.SellingPrice ?? product.SellingPrice` and feeds it to `computeDtfEstimate`, which adds print rates + overheads + a single global profit + order extra from `DtfPriceItems`. So today a DTF print on a 1590 product would price the garment at 1590, not 750+500.
- **DTF "profit" is one global number**, not per-garment: `dtfPricing` reads a single `DtfPriceItems` row of `Category='Profit'` for all garments.
- Net: the codebase can express per-product cost/sell prices and DTF print add-ons, but it **cannot** (a) share one blank's stock across multiple sellable products, nor (b) price the DTF garment from cost+profit instead of retail. Those are the two real gaps.

## Detailed Findings

### Data model (live MSSQL; `db/*.sql` schema files for products/variants are empty stubs — code is the source of truth)
- `Products`: base `Id, Name, SKU, CategoryId, CostPrice, SellingPrice, CreatedAt` + storefront columns `Slug, Description, ImageUrl, CompareAtPrice, IsActive, IsFeatured, IsNewArrival, IsDtfPrintable, SortOrder` (`db/12_ecommerce.sql`, `db/15_new_arrivals.sql`, `db/16_dtf_orders.sql`).
- `ProductVariants`: `Id, ProductId, SizeId, ColorId, Qty, CostPrice, SellingPrice` — **the unit of stock and price**. No link to any other product.
- `StockHistory(VariantId, ChangeQty, Reason, PreviousQty, NewQty, PriceAtChange, CreatedAt)` logs manual stock ops and DTF confirm/cancel.
- `DtfPriceItems(Category in Garment|Print|Overhead|Profit|Charge, Name, Amount, …)` — print rates/overheads/profit/charges for the DTF estimate; the `Garment` category is legacy (admin "Price Setup" no longer manages it).

### Catalog / stock management (admin)
- `addProduct(categoryId, name, cost, sell)` creates a `Product` with `CostPrice`+`SellingPrice` (`src/app/(main)/stocks/actions.ts:71`). `updateProduct` propagates new cost/sell to **all** that product's variants (`stocks/actions.ts:83-104`).
- `quickStock(productId, sizeId, colorId, qty, cost, sell, add|remove)` finds/creates the `(product,size,color)` variant and adjusts `Qty` + writes `StockHistory` (`stocks/actions.ts:111-191`). This is how M–XL × black/white stock is entered.
- `transferStock(fromProductId, toProductId, size, color, qty, …)` moves qty between two products' variants, writing `transfer-out`/`transfer-in` history (`stocks/actions.ts:221-338`). The **only** existing way one product's stock can feed another.
- `getStockItems()` lists variants with `Qty > 0` joined to product/size/color/category (`stocks/actions.ts:194`). Inventory/Stocks/Sales/Reports all read `ProductVariants.Qty`.
- Storefront catalog admin edits per-product storefront fields + the `IsActive/IsFeatured/IsNewArrival/IsDtfPrintable` flags (`src/app/(main)/catalog/actions.ts`).

### Pricing (retail vs cost)
- Retail price shown/charged = variant `SellingPrice` (falls back to product `SellingPrice`): used in storefront `PRODUCT_SELECT`, `getVariant`, checkout re-pricing (`src/app/(shop)/checkout/actions.ts:72`).
- True cost = `CostPrice`; profit in reports = `Qty * (SellingPrice - CostPrice)` via `pv.CostPrice` (`src/app/(main)/orders/actions.ts:197-201`). So a product priced 1590 with cost 750 already reports the right margin for a **plain** sale.

### DTF estimate (the pricing gap)
- `getDtfGarment(productId)` returns the product + variants (with each variant's `SellingPrice`) (`src/lib/storefront.ts`).
- `createDtfOrder` picks `garmentPrice = variant.SellingPrice ?? product.SellingPrice` (`src/app/(shop)/customize/actions.ts:55-60`) and calls `computeDtfEstimate({ garmentPrice, printNames, qty })`.
- `computeDtfEstimate` (`src/lib/dtfPricing.ts:69-100`): `perPiece = garmentPrice + Σ(selected Print rates) + Σ(active Overhead) + profit`; `total = perPiece*qty + orderExtra`. `profit` is a single global `DtfPriceItems` `Category='Profit'` row (`dtfPricing.ts:36`). **There is no concept of "garment cost + per-garment DTF profit"** — it just reuses retail `SellingPrice`.
- The client preview mirrors this (`src/app/(shop)/customize/CustomizeForm.tsx` uses `variant.SellingPrice ?? product.SellingPrice` + the same config).

### Stock decrement points (all hit one product's variant Qty)
- Web order: `createWebOrder` → `UPDATE ProductVariants SET Qty = Qty - @Qty` for the ordered variant (`checkout/actions.ts:181`).
- Admin order: `validateAndReduceStock` / `restoreStockFromOrder` (`orders/actions.ts:263,281`).
- DTF confirm/cancel: `confirmDtfOrder`/`setDtfOrderStatus` decrement/restore the chosen variant (`src/app/(main)/dtf-orders/actions.ts`).
- Because each is tied to a single `ProductVariant`, selling the "signature" product or DTF-printing draws down **that product's** stock — **not** a shared blank pool.

## Code References
- `src/app/(main)/stocks/actions.ts:71,83,111,194,221` — product/variant CRUD, quick stock, stock list, transfer.
- `src/app/(main)/catalog/actions.ts` — storefront product fields + flags.
- `src/app/(shop)/customize/actions.ts:55-65` — DTF garment price = retail SellingPrice.
- `src/lib/dtfPricing.ts:31-100` — estimate formula + single global profit.
- `src/lib/storefront.ts` — `PRODUCT_SELECT`, `getDtfGarment`, `getProductVariants`.
- `src/app/(shop)/checkout/actions.ts:72,181` — retail re-pricing + stock decrement.
- `src/app/(main)/orders/actions.ts:197,263,281` — cost-based profit + stock reduce/restore.

## Architecture / Conventions Observed
- One `Product` = one sellable SKU with its own variants, stock, and prices. "Variations" are size/colour within a product, not different price tiers or print states.
- Stock is a single integer per variant; consistency across modules comes from everyone reading/writing `ProductVariants.Qty`.
- Both `CostPrice` and `SellingPrice` exist at product and variant level; retail uses Selling, profit uses Cost.
- DTF pricing is additive over a garment base, with print/overhead/profit/charge rates centralised in `DtfPriceItems` (admin-editable), but the garment base is taken from the product's retail price.
- New per-product behaviour is typically a `Products` column/flag surfaced through the catalog admin (e.g. `IsDtfPrintable`).

## Related Prior Work (from workflow/)
- `workflow/research/2026-06-20-dtf-printing-module.md` + plan — built DTF orders; garment price intentionally taken from the real product's selling price (the assumption this workflow now wants to change).
- `workflow/research/2026-06-19-ecommerce-storefront-transformation.md` — the catalog/stock/orders foundation.

## Open Questions (for the Plan — the real decisions)
1. **Shared stock across plain / signature / DTF:** options to weigh —
   (a) **One product, multiple price tiers**: keep a single "Oversized Tee" product (one stock pool) and model "plain vs signature" as a choice/variant attribute or a per-line price, so DTF and both sale types draw the same `Qty`. Cleanest stock, but needs a way to sell the same blank at two prices and mark "signature = print-after-order".
   (b) **Separate products linked to a shared blank**: add a "blank/parent" link (e.g. `Products.BlankProductId`) so plain + signature both decrement the blank's variant stock. Most flexible for distinct product pages/prices, but stock decrement logic in all order paths must redirect to the blank.
   (c) **Status quo + transfer**: keep separate products and rely on manual `transferStock`. No code change, but error-prone and "with confusion" — which the owner explicitly wants to avoid.
2. **DTF garment price source:** should the DTF estimate use the product's **`CostPrice`** (e.g. 750) + a **DTF profit** instead of retail `SellingPrice`? And is that DTF profit the existing single global `DtfPriceItems` `Profit` (e.g. 500) or a **per-product/per-garment** value editable in the backend?
3. **"Signature collection" semantics:** is signature a *separate product* (own page, Rs 1890, printed on demand from the blank) or the *same product* sold at a higher tier? Does a signature sale also need a print/production step like DTF (it's "printed after order")?
4. **Where the owner sets things:** per-product fields needed (e.g. retail price, cost, "DTF profit override", "is print-on-demand", "blank link") and where in the catalog/stocks admin they live.
5. **Reporting/cost integrity:** signature/DTF sales should still report margin against the **blank cost (750)**, not the retail of a different product — keep `CostPrice` truthful across the shared model.
6. **Backwards compatibility:** existing single-product DTF orders price the garment at retail; changing the source affects new estimates only (existing `DtfOrders` store their own `GarmentPrice`).

## Next
Saved to `workflow/research/2026-06-21-shared-stock-and-dtf-garment-pricing.md`. Recommend `/plan shared-stock-and-dtf-garment-pricing` — the open questions (esp. #1 and #2) need your decisions before implementation.
