---
date: 2026-06-20
slug: color-images-and-quick-view
status: shipped   # draft | approved | implementing | shipped
surfaces: [database, storefront, admin]
research: workflow/research/2026-06-20-color-images-and-quick-view.md
estimated_manual_effort: 3h 10m
repo: essencefit-dashboard (single Next.js 16 repo)
database: InvFin (MSSQL) — name & connection UNCHANGED
gate: npm run build
---

# Color images, swatches, hover-swap & Quick View — Implementation Plan

## Overview
Make the storefront colour-aware: upload images **per colour**, show colour **swatches** (auto-derived
from the colour name, admin-overridable) with the colour's text name, swap the gallery when a colour
is clicked, show colour dots + a **Quick View** drawer + **hover image-swap** (no zoom) on product
cards — all additive to `InvFin`.

## Estimated Manual Effort
**3h 10m** — total human-in-the-loop time only (reviewing each phase + manual verification at each
pause + the final `/validate`). Claude Code does the implementation, so no development hours are
counted. Includes a 10% buffer.

## Decisions (locked)
- **Swatch colour source = auto + optional override.** New `Colors.Hex NVARCHAR(20) NULL`. A built-in
  name→hex map (`src/lib/colorHex.ts`) gives every existing colour a swatch immediately; if a colour
  has an explicit `Hex`, that wins; if neither resolves, a neutral diagonal-split chip is shown.
  Always display the **swatch + the colour's text name** together.
- **Per-colour images = `ProductImages.ColorId UNIQUEIDENTIFIER NULL`.** `NULL` = shared/applies to
  all colours. Gallery for a selected colour shows that colour's images; if a colour has none, it
  falls back to the shared (`NULL`) images, then to `Products.ImageUrl`.
- **Cards** show up to ~5 colour dots + a "Quick View" button overlaid on the image (per the example
  screenshot). Clicking a dot opens the PDP with `?color=<id>` preselected. Hover swaps the image to
  the product's **2nd image** and the card **no longer zooms**.
- **Quick View** = right-side slide-over drawer reusing the same colour/size picker + add-to-cart as
  the PDP, plus a "View full details" link to the PDP.
- **Cart line item** keeps the colour **name** only (unchanged) — no schema change there.

## Current State (from research)
- `Colors` is name-only (no hex). `ProductImages` is **per-product** (`ProductId` only, no `ColorId`)
  — `db/12_ecommerce.sql:36-44`. PDP gallery & colour picker are separate, unlinked components.
- `src/components/shop/AddToCart.tsx:43-50,121-140` — colour list derived from `ProductVariants`,
  rendered as **text buttons**; selecting a colour does not affect the gallery.
- `src/components/shop/ProductGallery.tsx` — shared-image gallery, thumbnails, no colour/zoom.
- `src/components/shop/ProductCard.tsx:17-21` — bare `<Link>`; hover `scale-105` zoom; no swatches,
  no Quick View, single image. Used by home/shop/category/deals/related.
- `src/lib/storefront.ts` — `StoreProduct` has no colours/images; `PRODUCT_SELECT` returns only the
  primary `ImageUrl`. `getProductBySlug` returns `Images[]` (per-product); `getProductVariants`
  returns `ColorId/ColorName`.
- Admin image upload is per-product: `catalog/actions.ts setProductImages` + `catalog/page.tsx
  ProductEditModal`. Colours/variants are created in the Stocks page.
- No drawer/modal primitive exists in `src/components/shop/`.

## Desired End State
- Admin can, per product, upload a **separate image set for each colour** (plus a shared set), and
  set an optional **hex** for any colour.
- On the **PDP**, colours render as **swatch + name**; clicking a colour **swaps the gallery** to that
  colour's images. `?color=<id>` preselects.
- **Product cards** show colour dots + a **Quick View** button; hovering the image **swaps to the 2nd
  image** (no zoom); Quick View opens a **side drawer** with gallery + colour/size + add-to-cart.
- `npm run build` stays green; existing catalog/admin flows keep working.

## What We're NOT Doing
- No image zoom/lightbox (explicitly out — "don't zoom").
- No per-colour pricing/stock changes (stock stays per variant as today).
- No colour-picker library; the admin hex input is a native `<input type="color">` + text.
- No change to cart/order schema or the colour stored on order lines (name only).
- No bulk colour-image migration of existing products (admin uploads as needed; shared images keep working).

## Touchpoints (single repo)
- **Database (`InvFin`)**: additive migration `db/13_color_images.sql` — `Colors.Hex`,
  `ProductImages.ColorId`, index on `(ProductId, ColorId)`, backfill `Colors.Hex` from the name map.
- **Shared libs**: new `src/lib/colorHex.ts` (name→hex map + `resolveSwatch(name, hex)`); extend
  `src/lib/storefront.ts` (colours+hover image on `StoreProduct`/`PRODUCT_SELECT`; images-by-colour
  on detail; `getQuickView`).
- **Admin (`src/app/(main)/catalog/`)**: `actions.ts` (`setProductImages` w/ colorId, colour-hex
  CRUD, `getProductForEdit` w/ colorId); `page.tsx` (per-colour upload UI + a Colours/hex section).
- **Storefront (`src/components/shop/`, `src/app/(shop)/`)**: `ProductCard` (swatches, hover-swap,
  Quick View button), new `ColorSwatch`, new `ProductView` (shares colour state PDP), new
  `QuickViewDrawer` (+ a provider/portal), `ProductGallery` (controlled active set), PDP page wiring.

---

## Phase 1: Schema — colour hex + per-colour images
### Changes
#### Migration — `db/13_color_images.sql` (idempotent; applied via `node db/apply.mjs`)
```sql
IF COL_LENGTH('Colors', 'Hex') IS NULL
  ALTER TABLE Colors ADD Hex NVARCHAR(20) NULL;            -- e.g. '#1B1B3A'

IF COL_LENGTH('ProductImages', 'ColorId') IS NULL
  ALTER TABLE ProductImages ADD ColorId UNIQUEIDENTIFIER NULL;  -- NULL = all colours

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ProductImages_Product_Color')
  CREATE INDEX IX_ProductImages_Product_Color ON ProductImages(ProductId, ColorId);
```
Backfill `Colors.Hex` for rows whose `Name` matches a known CSS/common colour (Red, Blue, Black,
White, Navy, Green, Grey/Gray, etc.) via a `CASE` statement; leave the rest `NULL`.
### Success Criteria
#### Automated (gate)
- [x] `npm run build` is green.
- [x] Introspection shows `Colors.Hex` and `ProductImages.ColorId` exist + the new index.
#### Manual
- [ ] Existing admin (catalog, stocks, orders) and the storefront still load unchanged.

**Pause here** before Phase 2.

---

## Phase 2: Colour-hex helper + admin colour management
### Changes
#### `src/lib/colorHex.ts`
A `COLOR_NAME_HEX: Record<string,string>` map (lowercased common colours) + `resolveSwatch(name,
hex?)` returning `{ hex: string | null, twoTone: boolean }` — explicit `hex` wins, else map lookup,
else `null` (caller renders a neutral split chip). Pure, importable by server & client.
#### `src/app/(main)/catalog/actions.ts`
`getColorsAdmin()` (Id, Name, Hex, usage count) and `updateColorHex(id, hex|null)`.
#### `src/app/(main)/catalog/page.tsx`
Add a **Colours** tab next to Products/Categories: list each colour with a live swatch, a native
`<input type="color">` + hex text field, and Save. Shows the auto-resolved swatch when Hex is empty.
### Success Criteria
#### Automated (gate)
- [x] `npm run build` is green.
#### Manual
- [ ] Colours tab lists all colours with auto swatches; setting a hex on one persists and shows.

**Pause here** before Phase 3.

---

## Phase 3: Admin — per-colour image upload
### Changes
#### `src/app/(main)/catalog/actions.ts`
- `getProductForEdit` → return images as `{ Url, ColorId, SortOrder }` and the product's colours
  (from `ProductVariants` joined to `Colors`, incl. Hex).
- `setProductImages(productId, images: { url, colorId|null }[])` — replace all `ProductImages` for
  the product, persisting `ColorId`; set `Products.ImageUrl` to the first **shared/`NULL`** image,
  else the first image overall.
#### `src/app/(main)/catalog/page.tsx` — `ProductEditModal`
Render an upload group per product colour (swatch + name) **plus** a "General (all colours)" group.
Each group uploads (`/api/upload?folder=products`), lists/reorders/removes its own images, and tags
them with that `colorId` (or `null` for General). Save sends the combined list.
### Success Criteria
#### Automated (gate)
- [x] `npm run build` is green.
#### Manual
- [ ] For a multi-colour product, upload different images under two colours + the General group;
      reload — each colour keeps its own images; primary thumbnail still set.

**Pause here** before Phase 4.

---

## Phase 4: PDP — colour-filtered gallery + swatches
### Changes
#### `src/lib/storefront.ts`
- `getProductBySlug` (or a new `getProductImagesByColor`) returns images grouped:
  `{ byColor: Record<colorId, string[]>, shared: string[] }`.
- Extend `getProductVariants`/a colours helper to include `Hex` per colour.
#### `src/components/shop/ProductGallery.tsx`
Accept a controlled `images: string[]` (active set) so the parent can swap it on colour change
(keeps thumbnails; still no zoom).
#### `src/components/shop/ProductView.tsx` (new, client)
Wrap gallery + `AddToCart`, owning `colorId` state (init from `?color=` if present). Compute the
active image set: `byColor[colorId] ?? shared ?? [ImageUrl]`. `AddToCart` becomes **controlled**
for colour (`colorId`, `onColorChange`) and renders colours as `ColorSwatch` (swatch + name).
#### `src/components/shop/ColorSwatch.tsx` (new)
Round swatch from `resolveSwatch`; selected ring; neutral split chip when no hex; shows name beside it.
#### `src/app/(shop)/product/[slug]/page.tsx`
Pass grouped images + colours(+hex) into `ProductView`; keep server-rendered name/price/description.
### Success Criteria
#### Automated (gate)
- [x] `npm run build` is green.
#### Manual
- [ ] On a multi-colour product, colours show as swatch+name; clicking a colour swaps the gallery to
      that colour's images (falls back to shared when empty); `/product/<slug>?color=<id>` preselects.

**Pause here** before Phase 5.

---

## Phase 5: Product cards — swatches + hover image-swap (no zoom)
### Changes
#### `src/lib/storefront.ts`
- `StoreProduct` += `HoverImageUrl: string | null` and `Colors: { Id; Name; Hex|null }[]`.
- `PRODUCT_SELECT` += a subquery for the 2nd image (by `SortOrder`) and a colours aggregation
  (distinct colours for the product with Hex). Keep it set-based for list performance.
#### `src/components/shop/ProductCard.tsx`
- Remove `group-hover:scale-105`; on hover show `HoverImageUrl` (cross-fade) when present.
- Render up to ~5 `ColorSwatch` dots under the price; each dot links to `/product/<slug>?color=<id>`.
- Keep discount/out-of-stock badges.
### Success Criteria
#### Automated (gate)
- [x] `npm run build` is green.
#### Manual
- [ ] Cards show colour dots; hovering a multi-image product swaps to the 2nd image (no zoom);
      clicking a dot opens the PDP on that colour. Single-image products behave gracefully.

**Pause here** before Phase 6.

---

## Phase 6: Quick View side drawer
### Changes
#### `src/lib/storefront.ts`
`getQuickView(productId)` → product core + grouped images + variants/colours(+hex) — enough to render
the drawer and add to cart.
#### `src/components/shop/QuickViewDrawer.tsx` + `QuickViewProvider` (new, client)
A right-side slide-over (portal/fixed overlay) with a compact gallery + `ColorSwatch` colour picker +
size + qty + add-to-cart (reusing `AddToCart`/`ProductView` logic) and a "View full details" link to
the PDP. A context provider exposes `openQuickView(productId)`; mounted once in the `(shop)` layout.
#### `src/components/shop/ProductCard.tsx`
Add a **Quick View** button overlaid on the image (visible on hover / always on mobile) that calls
`openQuickView(p.Id)` instead of navigating. (Card becomes a client component or gets a small client
overlay; the surrounding link still goes to the PDP.)
#### `src/app/(shop)/layout.tsx`
Wrap children in `QuickViewProvider` and mount the drawer once.
### Success Criteria
#### Automated (gate)
- [x] `npm run build` is green.
#### Manual
- [ ] Quick View opens a right drawer with images, colour swatches (swap images), size, and a working
      add-to-cart; "View full details" goes to the PDP; closing returns to the listing.
- [ ] Full storefront walkthrough (home → card hover/swatch/quick-view → PDP colour gallery → cart)
      works on desktop + mobile.

**Pause here** for final `/validate`.

---

## Testing Strategy
No automated test suite. Gate per phase = `npm run build`; verify each phase's manual steps against
live `InvFin` data. Seed note: pick (or create) a product with ≥2 colours and ≥2 images per colour to
exercise gallery-swap, card swatches, hover-swap, and Quick View. Confirm existing admin/storefront
flows after each schema/UI change.

## Rollback / Safety
Migration is additive + idempotent (new nullable columns + index). Existing per-product images keep
working because shared images are `ColorId = NULL`. New storefront pieces are mostly new components;
`ProductCard` and the PDP are refactored but keep their existing data plus new optional fields.

## References
- Research: `workflow/research/2026-06-20-color-images-and-quick-view.md`
- Patterns to follow: per-product images `catalog/actions.ts setProductImages`; colour-from-variants
  `AddToCart.tsx:43-50`; gallery `ProductGallery.tsx`; list query `storefront.ts PRODUCT_SELECT`;
  upload `api/upload/route.ts`; admin modal `catalog/page.tsx ProductEditModal`.
- Industry standard considered: per-colour image sets keyed by a variant/option (Shopify "variant
  images") + named-colour swatches with a hex override is the standard e-commerce pattern; a
  nullable `ColorId` on the existing images table matches this repo's additive raw-`mssql` convention
  without a new join table. Quick-view side drawers + secondary-image hover are standard storefront UX.
```
