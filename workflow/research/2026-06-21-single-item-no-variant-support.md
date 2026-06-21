---
date: 2026-06-21
topic: "Selling one-off items that have no size/colour variant (e.g. caps, accessories, unique pieces)"
backend_commit: 9cb6f25
app_commit: n/a
public_site_commit: n/a
status: complete
tags: [research, stock, variants, storefront, inventory]
---

# Research: Single / No-Variant Item Support

## Research Question
The shop has product types ("caps", accessories, unique pieces) that are **one of each** — a single physical item with no size/colour matrix. Today such a product shows **Sold out** and can't be bought. Document how stock/variants work as-is and exactly what assumes a size+colour exists, so we can support attribute-less items (Option B).

## Summary
Selling happens **only through `ProductVariants`** rows; a product's stock is the sum of its variants' `Qty`. A one-off item created without any variant row therefore has 0 stock → "Sold out" (confirmed live: "Premium Caps (IMPORTED)" has `OwnVariants = 0`).

**The database already supports attribute-less variants** — `ProductVariants.SizeId` and `ColorId` are **nullable**, and **3 such rows already exist** (NullSize=3, NullColor=3 of 131). The blockers are **application-layer only**:
- The **Stocks "Quick Stock" UI requires** a size *and* a colour (`stocks/page.tsx:210`), and `quickStock` looks up/creates a variant by `ProductId+SizeId+ColorId` (`stocks/actions.ts:111-146`) — so you can't create a null-size/colour variant from the admin.
- The **Stocks list, Inventory, WhatsApp, and several reports `INNER JOIN` Sizes/Colors**, so attribute-less variants are invisible there.

The **storefront sell path already tolerates null size/colour**: `getProductVariants` `LEFT JOIN`s sizes/colours, and `AddToCart`/`ProductView` derive `hasSizes`/`hasColors` from the data — with neither present, they auto-select the single variant and render Add-to-cart with no pickers. Checkout, admin order detail, invoices, DTF, and stock-history all `LEFT JOIN`, so they display "—" gracefully. The stock resolver `dbo.fn_StockVariantId` already matches on size/colour with `ISNULL(...)`, so null/null variants resolve correctly.

So Option B = "make the admin create & see attribute-less variants" + (optionally) include them in reports — **no schema change required**.

## Detailed Findings

### Data model — nullable already
- `ProductVariants(Id, ProductId NOT NULL, SizeId NULL, ColorId NULL, Qty NOT NULL, SellingPrice NULL, CostPrice NULL, CreatedAt)` — live `INFORMATION_SCHEMA`: `SizeId`/`ColorId` `IS_NULLABLE = YES`. 3 variants already have both null.
- A product's storefront stock = `SUM(Qty)` of its variants (resolved through the blank): `src/lib/storefront.ts:42` (`PRODUCT_SELECT`) and `:333`.

### What ALREADY tolerates null size/colour (no change needed)
- **Storefront variants**: `getProductVariants` `LEFT JOIN Sizes/Colors` (`src/lib/storefront.ts:339-340`) → returns `SizeName/ColorName = null`.
- **Add to cart / PDP**: `hasSizes = variants.some(v => v.SizeId)`, `hasColors = variants.some(v => v.ColorId)`; with both false, `sizeId`/`colorId` default to `"none"`, the single variant matches, and `canAdd = stock>0` (`src/components/shop/AddToCart.tsx:58-59,79,92-103,116-119`). No size/colour chips render.
- **Checkout / order detail / invoices / DTF / stock-history / account**: all `LEFT JOIN` sizes/colours (`checkout/actions.ts:261-262`, `orders/actions.ts:253-254`, `orders/invoiceActions.ts:38-39,111-112`, `dtf-orders/actions.ts:45-46`, `stock-history/actions.ts:55-56`, `account/actions.ts:191-192`).
- **Stock resolver**: `dbo.fn_StockVariantId` matches size/colour with `ISNULL(CONVERT(NVARCHAR(36), …), '')` (`db/18_shared_stock.sql:33-35`) — null/null is handled.
- **Order stock decrement/restore**: keyed by `VariantId` only — indifferent to size/colour (`orders/actions.ts:264-292`, `checkout/actions.ts:209-213`).

### What BLOCKS creating an attribute-less item (must change for Option B)
- **Stocks Quick Stock form** requires all of product/size/colour/qty: `if (!productId || !sizeId || !colorId || !qty) … "Please fill all fields!"` (`src/app/(main)/stocks/page.tsx:210`); the size & colour `<select>`s have no "none" option (`:788-827`).
- **`quickStock`** finds/creates the variant by `ProductId AND SizeId=@SizeId AND ColorId=@ColorId` (`src/app/(main)/stocks/actions.ts:123-146`); passing empty strings would not match a `NULL` row and the inputs aren't typed as `UniqueIdentifier`/nullable.
- **Stocks "Current Stock Items" list** hides them: `getStockItems` uses `INNER JOIN Sizes` + `INNER JOIN Colors` (`src/app/(main)/stocks/actions.ts:211-212`).

### What SILENTLY EXCLUDES attribute-less items (reporting/secondary — optional to fix)
- **Inventory** views: `INNER JOIN Colors/Sizes` (`src/app/(main)/inventory/actions.ts:73-74,164-165,196-198`).
- **WhatsApp** stock query: `INNER JOIN Sizes/Colors` (`src/app/(main)/whatsapp/actions.ts:36-37`).
- **Dashboard** breakdown: `JOIN Sizes/Colors` (`src/app/(main)/dashboard/actions.ts:124-125`).
- **Analysis / Sales / Returns / Color-requests** breakdowns by size/colour `JOIN` (inner) Sizes/Colors (`analysis/actions.ts:29,46,106-108`; `sales/actions.ts:29,46-47`; `returns/actions.ts:51,67`; `color-requests/actions.ts:27,42`).
- **Admin order builder** cascade: `getSizesByProduct`/`getColorsByProductAndSize` inner-join (`orders/actions.ts:40,56`) → an attribute-less product can't be added through the admin order form's size→colour cascade (its storefront/edit/delete paths are fine).

### Where products & variants are created today
- Products are created in Stocks via `addProduct(category, name, cost, sell)` — **no variant** is made (`stocks/page.tsx:331-342`). Variants come only from Quick Stock (`quickStock`) or the catalog blank-link sync. This is why a freshly added cap has zero variants.

## Code References
- `src/app/(main)/stocks/page.tsx:210,788-827` — Quick Stock requires size+colour
- `src/app/(main)/stocks/actions.ts:111-146,211-212` — quickStock keying; list INNER JOINs
- `src/lib/storefront.ts:42,333,339-340` — stock sum + LEFT JOIN variants
- `src/components/shop/AddToCart.tsx:58-119` — null size/colour handled
- `db/18_shared_stock.sql:24-39` — `fn_StockVariantId` ISNULL matching
- `src/app/(main)/inventory/actions.ts:73-74,164-165,196-198` — inventory INNER JOINs
- live DB — `ProductVariants.SizeId/ColorId` nullable; 3 attribute-less rows already exist

## Architecture / Conventions Observed
- One sell unit = one `ProductVariants` row; size/colour are optional attributes of that row (already nullable).
- Customer-facing + order/finance/ledger paths use `LEFT JOIN` and a null-tolerant resolver.
- Admin **management & reporting** paths assume size+colour via `INNER JOIN` and required form fields — that's the gap for one-off items.

## Related Prior Work (from workflow/)
- `workflow/research/2026-06-21-order-and-stock-sync-audit.md` — the shared stock pool + `fn_StockVariantId` resolver these items flow through.
- `workflow/research/2026-06-21-shared-stock-and-dtf-garment-pricing.md` — variant model + blank resolver origin.

## Open Questions
- Admin UX for "no variant": a **"No size / No colour" option** in the Quick Stock selects, or a dedicated **"Single item (one-off)"** toggle when adding the product that auto-creates one variant? (Affects `stocks/page.tsx` + `quickStock` signature.)
- Scope of the reporting fixes: just make them **visible** in Stocks (required), or also include attribute-less items across Inventory/WhatsApp/Dashboard/Analysis/Sales/Returns and the admin order builder (broader, optional)?
- Should `quickStock` (and the unique index, if any) treat `NULL` size/colour as a single distinct variant per product (so re-adding stock to the same one-off finds the same row)?
