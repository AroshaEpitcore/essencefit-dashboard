---
date: 2026-06-21
topic: "Products where each image is a distinct design the customer selects (image-as-variant), and the order records which design was bought"
backend_commit: 9cb6f25
app_commit: n/a
public_site_commit: n/a
status: complete
tags: [research, storefront, images, cart, orders, product-type]
---

# Research: Design-Per-Image Products

## Research Question
Some products (e.g. "Premium Caps (IMPORTED)") have many images that are **different designs**, not colour variants. Today the customer can't pick a specific design and the admin can't tell which design was ordered. We want: mark a product as this type, show each image as a **selectable** thumbnail (click to view), let the customer **order the chosen design**, and have that selection **recorded on the order** — without breaking the existing colour/size/variant flow. Document how the relevant pieces work today.

## Summary
Today the storefront sells a **`ProductVariants` row** chosen by **size + colour swatches**; images are only *display* (a gallery), never a selectable "what am I buying" dimension. The order line (`OrderItems`) stores **only `VariantId`, `Qty`, `SellingPrice`** — there is **no field for a chosen image/design**, and admin order views derive name/size/colour from the variant + the product's primary image, so a per-design choice cannot currently be captured or shown.

Concretely, three things make "design per image" not expressible as-is:
1. **Images aren't sellable units.** `ProductImages` (Id, ProductId, Url, SortOrder, ColorId) are grouped into `byColor`/`shared` and rendered as a gallery (`src/lib/storefront.ts:289-302`; `ProductGallery.tsx`). Selection happens on **colour swatches** built from variants (`AddToCart.tsx:62-70,147-183`), not on images.
2. **The cart is keyed by `variantId` only.** `CartItem` has `image/color/size` but the cart merges by `variantId` (`CartContext.tsx:5-16,50-59`). A product with one variant and many designs would collapse all designs into one line — two different designs can't coexist in the cart.
3. **The order has nowhere to record the design.** `OrderItems` = `Id, OrderId, VariantId, Qty, SellingPrice` (live schema). Order reads show `p.ImageUrl` (the product's primary image), `SizeName`, `ColorName` — not a per-line image (`orders/actions.ts:231-259`; `checkout/actions.ts:240-267`; `account/actions.ts:187-198`).

There **is** a clean identity to reference a design: each `ProductImages` row has a stable **`Id`** (and `Url`). And the codebase has a well-worn **per-product boolean-flag pattern** (`IsDtfPrintable`, `PrintOnDemand`, `IsFeatured`, `IsNewArrival`) toggled in the Catalog edit modal — the natural way to mark "this product is selected by image". So the feature is feasible and isolated: it would add a product-type flag, an image-selection UI branch, a cart key that includes the chosen image, and a place to persist + display the chosen design on the order — none of which the existing colour/size path needs to use.

## Detailed Findings

### Product images (storage + display)
- `ProductImages(Id, ProductId, Url, SortOrder, ColorId NULL, CreatedAt)` — each image has a stable `Id`; `ColorId` ties an image to a colour (or NULL = shared) (live schema).
- Storefront groups them: `getProductImagesByColor` → `{ byColor: {colorId: url[]}, shared: url[] }` (`src/lib/storefront.ts:289-302`).
- `ProductView` picks the active set from the selected colour and passes it to `ProductGallery` (`src/components/shop/ProductView.tsx:45-53,72`); `ProductGallery` renders a grid + click-to-zoom **lightbox** (view only, no select) (`src/components/shop/ProductGallery.tsx`).
- Admin manages images in the Catalog edit modal, grouped by colour (`src/app/(main)/catalog/page.tsx:518-569`), via `setProductImages` (`src/app/(main)/catalog/actions.ts:186-217`).

### What the customer selects (today = colour/size, not image)
- `AddToCart` builds **colour swatches** and **size chips** from `variants` and resolves the chosen `variant` (`src/components/shop/AddToCart.tsx:62-103,147-211`).
- On add, it pushes a `CartItem` with `variantId`, plus `image` = the currently shown image, `color`, `size` (`AddToCart.tsx:116-135`). `image` is the colour's image (`ProductView` passes `currentImage = activeImages[0]`), **not** a per-design pick.

### Cart (keyed by variant)
- `CartItem = { variantId, productId, name, slug, image, size, color, price, qty, maxStock }` (`src/components/shop/CartContext.tsx:5-16`).
- `addItem` merges by `variantId` (`:50-59`); `removeItem`/`updateQty` also key by `variantId` (`:61-71`). Persisted to `localStorage` `ef_cart`.

### Order capture + display (no design field)
- Web checkout sends only `{ variantId, qty }` per line (`src/app/(shop)/checkout/page.tsx:95`) → `createWebOrder` re-prices and inserts `OrderItems(Id, OrderId, VariantId, Qty, SellingPrice)` (`src/app/(shop)/checkout/actions.ts:199-207`).
- `OrderItems` has **no** image/design/note column (live schema).
- Reads that show a line use the **product** image + variant size/colour, not a per-line image:
  - confirmation: `p.ImageUrl, SizeName, ColorName` (`checkout/actions.ts:252-264`)
  - admin order detail: `p.Name, SizeName, ColorName`, `p.ImageUrl` absent per-line (`orders/actions.ts:231-259`)
  - customer "My orders" is order-level only (`account/actions.ts:126-157`).
- DTF orders are the existing precedent for capturing **customer artwork**: a separate `DtfOrders`/`DtfOrderDesigns` table stores uploaded design URLs per order (`db/16_dtf_orders.sql`; `customize/actions.ts:152-163`) — a different flow (custom upload, not pick-an-existing-image), but shows how "which design" is modeled elsewhere.

### Product-type flag pattern (how "this kind of product" is marked)
- Boolean columns on `Products`: `IsActive, IsFeatured, IsNewArrival, IsDtfPrintable, PrintOnDemand` — set in the Catalog edit modal as checkboxes and read across storefront/admin (`src/app/(main)/catalog/actions.ts:26-31,100-126`; `catalog/page.tsx:487-492`).
- Adding a `Products.SelectByImage` (or similar) BIT would follow this exact pattern and let the storefront branch its selector UI for that product only.

## Code References
- `src/lib/storefront.ts:289-302` — `getProductImagesByColor` (byColor/shared)
- `src/components/shop/ProductView.tsx:45-72` — active image set + gallery wiring
- `src/components/shop/ProductGallery.tsx` — image grid + view-only lightbox
- `src/components/shop/AddToCart.tsx:62-135,147-211` — colour/size selection → CartItem
- `src/components/shop/CartContext.tsx:5-16,50-71` — cart shape, merge-by-variantId
- `src/app/(shop)/checkout/actions.ts:199-267` — OrderItems insert + confirmation read
- `src/app/(main)/orders/actions.ts:231-259` — admin order detail read
- live schema — `OrderItems(Id, OrderId, VariantId, Qty, SellingPrice)`, `ProductImages(Id, ProductId, Url, SortOrder, ColorId, CreatedAt)`
- `src/app/(main)/catalog/actions.ts:26-31,100-126`, `catalog/page.tsx:487-492` — product flag pattern
- `db/16_dtf_orders.sql`, `src/app/(shop)/customize/actions.ts:152-163` — per-order design capture precedent (DTF)

## Architecture / Conventions Observed
- The single sell unit is a `ProductVariants` row; size/colour are its attributes; images are presentation only.
- Per-product behaviour is switched by boolean flags on `Products`, toggled in Catalog.
- The order is the source of truth for "what was bought" and currently records only the variant — any new per-line attribute (a chosen design) needs a column or side table, mirroring how DTF added `DtfOrderDesigns`.
- Customer/order/finance reads use null-tolerant `LEFT JOIN`s; the single-item (no size/colour) work already lets a product have one variant with no colour — a good base for caps.

## Related Prior Work (from workflow/)
- `workflow/research/2026-06-21-single-item-no-variant-support.md` — the caps are now a single no-variant product; this builds the "pick a design" layer on top.
- `workflow/research/2026-06-20-dtf-printing-module.md` — DTF's per-order design capture (`DtfOrderDesigns`) as a modelling precedent.
- `workflow/research/2026-06-21-order-and-stock-sync-audit.md` — order/stock flow these lines pass through.

## Open Questions
- **Stock model**: is each design its own stock (so a design = a real `ProductVariants` row, selected by image), or is it one shared pool for the product and the image is just a label on the line? (First gives per-design inventory + clean reuse of existing variant/stock/cancel logic; second is lighter but needs a new per-line field and has no per-design stock.)
- **Where to record the choice**: a new `OrderItems.SelectedImageId/Url` column, or model each design as a variant so `VariantId` already carries it? (Affects whether `OrderItems` changes.)
- **Cart key**: must include the chosen design (e.g. `variantId + imageId`) so two designs of the same product can coexist — confirm acceptable.
- **Admin visibility**: show the chosen design thumbnail on the admin order detail / Web Orders line, and/or on the customer's order confirmation.
- **Toggle UX**: a `Products.SelectByImage` flag in Catalog that swaps the colour swatches for image-thumbnail selection on that product only (leaving every other product unchanged).
