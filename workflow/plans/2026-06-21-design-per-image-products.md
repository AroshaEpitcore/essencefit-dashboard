---
date: 2026-06-21
slug: design-per-image-products
status: implementing
surfaces: [storefront, admin, db]
research: workflow/research/2026-06-21-design-per-image-products.md
estimated_manual_effort: 2h 30m
---

# Design-Per-Image Products — Implementation Plan

## Overview
Add a per-product **"Select by image (designs)"** mode where each uploaded image is a **distinct design with its own stock**, the customer picks a design by clicking its image, and the order records exactly which design was bought — modeled so each design is a normal `ProductVariants` row (the choice rides on `VariantId`), leaving the existing colour/size flow untouched.

## Estimated Manual Effort
**2h 30m** — total human-in-the-loop time only (reviewing each phase + manual verification at each pause + final `/validate`), with a 10% buffer. Claude Code implements; no dev hours counted.

## Current State
- Selling = a `ProductVariants` row chosen via colour swatches/size chips; images are display-only (`src/components/shop/AddToCart.tsx:62-70,147-183`; `src/components/shop/ProductGallery.tsx`).
- Cart merges by `variantId` only (`src/components/shop/CartContext.tsx:50-59`).
- `OrderItems(Id, OrderId, VariantId, Qty, SellingPrice)` — no design field (live schema); order reads show the product image + variant size/colour (`orders/actions.ts:231-259`, `checkout/actions.ts:240-267`).
- `ProductImages(Id, ProductId, Url, SortOrder, ColorId NULL, CreatedAt)` — each image has a stable `Id`; no link to a variant.
- Per-product behaviour uses boolean flags toggled in Catalog (`IsDtfPrintable`, `PrintOnDemand`, …) (`catalog/actions.ts:26-31,100-126`; `catalog/page.tsx:487-492`).
- One-off (null size/colour) variants already work end-to-end (storefront + stock + orders) from `single-item-no-variant-support`; `fn_StockVariantId` is null-tolerant (`db/18_shared_stock.sql:24-39`).

## Desired End State
- In Catalog, a product can be flagged **"Select by image"**. For such a product the admin uploads design images and sets a **qty per design**; each design becomes a `ProductVariants` row (SizeId/ColorId NULL) linked to its `ProductImages` row (`ProductImages.VariantId`).
- On the storefront, a select-by-image product shows its designs as a **thumbnail grid** (sold-out designs marked); clicking a thumbnail shows it large (with zoom) and selects it; **Add to cart** adds that design. Different designs of the same product **coexist in the cart** (distinct `variantId`).
- Buying decrements that design's stock through all existing paths (checkout, admin orders, cancel/restore) — **no new order logic**. The chosen design's image shows on the **cart line, customer confirmation, and admin order detail/Web Orders**.
- Every non-select-by-image product behaves exactly as today.

## What We're NOT Doing
- Not changing the colour/size selection path or `AddToCart` for normal products (a separate storefront branch/component handles design products).
- Not adding a column to `OrderItems` (the design = the variant; `VariantId` already records it).
- Not changing cart keying (distinct variant per design already separates them).
- Not mixing modes on one product (a product is either colour/size **or** select-by-image).
- Not building a Stocks-page editor for per-design qty (designs are managed in Catalog; the existing Stocks list will still show them as "—/—" rows — acceptable).

## Touchpoints per surface
- **DB**: `db/22_design_per_image.sql` — `Products.SelectByImage BIT`, `ProductImages.VariantId UNIQUEIDENTIFIER NULL` (+ index).
- **Admin**: `src/app/(main)/catalog/actions.ts` (flag in CRUD; `getProductDesigns`, `saveDesigns`), `src/app/(main)/catalog/page.tsx` (flag checkbox + Designs manager; branch save).
- **Storefront**: `src/lib/storefront.ts` (`SelectByImage` on detail; `getProductDesigns`), `src/app/(shop)/product/[slug]/page.tsx` (branch), new `src/components/shop/DesignPicker.tsx`.
- **Order display**: `src/app/(shop)/checkout/actions.ts` (confirmation line image), `src/app/(main)/orders/actions.ts` (`getOrderDetails` line image), `src/app/(main)/web-orders/*` (line/design thumb). Cart line image set at add-time (Phase 3).
- **Tenancy**: single-tenant — n/a.

---

## Phase 1: DB — flag + image↔variant link
### Changes
#### `db/22_design_per_image.sql` (idempotent; `node db/apply.mjs`)
```sql
IF COL_LENGTH('Products','SelectByImage') IS NULL
  ALTER TABLE Products ADD SelectByImage BIT NOT NULL CONSTRAINT DF_Products_SelectByImage DEFAULT 0;
GO
IF COL_LENGTH('ProductImages','VariantId') IS NULL
  ALTER TABLE ProductImages ADD VariantId UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ProductImages_VariantId')
  CREATE INDEX IX_ProductImages_VariantId ON ProductImages(VariantId);
GO
```
### Success Criteria
#### Automated
- [x] Migration applies + re-runs clean (`node db/apply.mjs db/22_design_per_image.sql`).
- [ ] App builds: `npm run build`
#### Manual
- [ ] `Products.SelectByImage` defaults 0 for all rows; `ProductImages.VariantId` exists and is NULL for existing images.

**Pause here** for confirmation.

---

## Phase 2: Catalog admin — flag + per-image Designs manager
### Changes
#### `src/app/(main)/catalog/actions.ts`
- Add `SelectByImage` to `CatalogProduct`, `getProductForEdit` SELECT, `ProductStorefrontInput`, and `updateProductStorefront` (SELECT/UPDATE) — same pattern as `IsDtfPrintable`.
- `getProductDesigns(productId)` → `SELECT pi.Id AS ImageId, pi.Url, pi.SortOrder, pi.VariantId, v.Qty, v.SellingPrice FROM ProductImages pi LEFT JOIN ProductVariants v ON v.Id = pi.VariantId WHERE pi.ProductId=@pid AND pi.ColorId IS NULL ORDER BY pi.SortOrder`. (Designs are colour-less images; for a select-by-image product these are the designs.)
- `saveDesigns(productId, designs: { imageId?: string; url: string; qty: number; }[])` in a transaction:
  - For each design: ensure a linked **variant** exists — if `imageId` has no `VariantId`, INSERT a `ProductVariants (ProductId, NULL, NULL, Qty, CostPrice, SellingPrice)` (prices from the product) and set the image's `VariantId`; else UPDATE that variant's `Qty`. New images: INSERT `ProductImages (ProductId, Url, ColorId=NULL, VariantId, SortOrder)`.
  - Removed designs (existing image rows not in payload): set their variant `Qty=0` and `DELETE` the `ProductImages` row, but **keep the variant** if it has `OrderItems` (history-safe); delete the variant only if unused.
  - Set `Products.ImageUrl` to the first design's URL if currently null.
  - Log each qty change to `StockHistory` ('stock-add'/'adjust') mirroring `stocks/actions.ts:187-190`.
#### `src/app/(main)/catalog/page.tsx`
- Add a **"Select by image (designs)"** checkbox to the flags row (`:487-492`).
- When checked: hide the colour image manager and show a **Designs manager** — upload images (reuse `uploadFile(..,"products")`), each design row shows a **Qty** input + remove; a "Save designs" calls `saveDesigns`. When unchecked: existing colour-image manager unchanged.
- `save()` branches: for select-by-image, call `saveDesigns` instead of `setProductImages` (so the colour-image path is never touched for these products).
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] Flagging "Premium Caps (IMPORTED)" as select-by-image, then adding its design images with qty, creates one null/null variant per design (each `ProductImages.VariantId` set) and `stock-add` history rows; editing a qty updates the right variant.
- [ ] A normal product's image manager and saving are unchanged.

**Pause here** for confirmation.

---

## Phase 3: Storefront — design picker
### Changes
#### `src/lib/storefront.ts`
- Add `SelectByImage: boolean` to `StoreProductDetail` and select `p.SelectByImage` in `getProductBySlug` (extend the `PRODUCT_SELECT.replace(...)`).
- `getProductDesigns(productId)` → `SELECT v.Id AS VariantId, pi.Url AS Image, ISNULL((SELECT z.Qty FROM ProductVariants z WHERE z.Id=dbo.fn_StockVariantId(v.Id)),0) AS Qty, ISNULL(v.SellingPrice, p.SellingPrice) AS Price FROM ProductImages pi JOIN ProductVariants v ON v.Id=pi.VariantId JOIN Products p ON p.Id=v.ProductId WHERE pi.ProductId=@pid ORDER BY pi.SortOrder`.
#### `src/app/(shop)/product/[slug]/page.tsx`
- If `product.SelectByImage`, fetch `getProductDesigns` and render the new `DesignPicker` (in place of `ProductView`); else unchanged.
#### `src/components/shop/DesignPicker.tsx` (new, client)
- Left: the selected design shown large with the existing zoom **lightbox** (reuse `ProductGallery` pattern). Right: the header/price slot + a **thumbnail grid** of designs (sold-out designs get the diagonal cut + disabled), a qty stepper, and Add-to-cart / Buy-now.
- `addItem({ variantId: design.VariantId, productId, name: `${name}`, slug, image: design.Image, size: null, color: null, price: design.Price, qty, maxStock: design.Qty })` — distinct `variantId` per design ⇒ designs coexist in the cart, and the cart line shows the design image.
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] The cap's product page shows a design thumbnail grid (no colour squares); clicking a thumbnail shows it large + opens the zoom; sold-out designs are marked.
- [ ] Adding two different designs creates two cart lines, each with its own design image; checkout reduces each design's own stock (verify `/stocks` + `/stock-history`).
- [ ] A normal colour/size product page is unchanged.

**Pause here** for confirmation.

---

## Phase 4: Show the chosen design on orders
### Changes
#### `src/app/(shop)/checkout/actions.ts`
- `getOrderForConfirmation` items: add `ISNULL((SELECT TOP 1 Url FROM ProductImages WHERE VariantId = oi.VariantId), p.ImageUrl) AS LineImage`; the confirmation UI shows `LineImage`.
#### `src/app/(main)/orders/actions.ts`
- `getOrderDetails` items: add the same `LineImage` expression so admin order detail shows the design thumbnail per line.
#### `src/app/(main)/web-orders/*`
- If the Web Orders detail lists items, show the per-line design thumbnail (reuse `getOrderDetails`/`getWebOrderDetails`).
### Success Criteria
#### Automated
- [x] App builds: `npm run build`
#### Manual
- [ ] After buying a specific cap design, the customer confirmation and the admin order detail both show **that design's** image on the line (not the generic product image); a normal product still shows its usual image.

**Pause here**, then run `/validate design-per-image-products`.

## Testing Strategy
No automated tests. Gate per phase = `npm run build` (+ the Phase 1 migration). End-to-end: (1) flag the cap select-by-image + add designs with qty (Catalog) → one variant per design; (2) storefront shows the design grid, pick + view; (3) add two designs → two cart lines → checkout → each design's stock drops + `order-sale` history; (4) cancel the order → each design's stock restored (existing order-sync); (5) confirmation + admin order detail show the chosen design images; (6) regression: a colour/size product (tee) and a plain one-off (existing cap setup) are unchanged.

## References
- Research: `workflow/research/2026-06-21-design-per-image-products.md`
- Flag pattern: `src/app/(main)/catalog/actions.ts:26-31,100-126`, `catalog/page.tsx:487-492`
- Image manager + setProductImages (leave untouched for designs): `catalog/page.tsx:518-569`, `catalog/actions.ts:186-217`
- Null-tolerant variant + resolver: `db/18_shared_stock.sql:24-39`, `src/components/shop/AddToCart.tsx:58-119`
- Cart shape: `src/components/shop/CartContext.tsx:5-16`
- Order reads to extend: `checkout/actions.ts:240-267`, `orders/actions.ts:231-259`
- Industry standard considered: print/design storefronts model each sellable design as its own SKU/variant (e.g. Shopify variant-per-design, Printful product variants), with the order line referencing the variant — this plan follows that (design = variant; choice via `VariantId`) rather than a free-text label, matching the repo's variant-as-sell-unit convention. (n/a external lib.)
