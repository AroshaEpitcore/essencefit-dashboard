---
date: 2026-06-20
topic: "Per-color product images (upload images per color; clicking a color shows that color's images), auto-derived color swatches shown with the color name, product cards showing color swatches + a Quick View that opens a side drawer with full details, and hover-to-swap-image on cards with multiple images (no zoom)"
repo: essencefit-dashboard (single Next.js repo)
commit: 336b9e4
database: InvFin (MSSQL)
status: complete
tags: [research, storefront, colors, product-images, product-card, quick-view, gallery]
---

# Research: Per-color images, color swatches, product-card quick view & hover image-swap (as-is)

> Adapted from the Maraebiz `/research` template to this single Next.js + MSSQL repo.
> Documents WHAT EXISTS TODAY for the storefront catalog/color/image surfaces.
> No proposals here — that's the Plan phase.

## Research Question
The user wants, on the storefront:
1. **Per-color images** — upload a separate set of images for each color of a product; clicking a
   color on the product page swaps the gallery to that color's images.
2. **Auto color swatch** — derive a visual color from the color (read/interpret the color) and show
   the **swatch + the color's text name** instead of a plain text button.
3. **Product card improvements** — show the available **color swatches** on the card and a **Quick
   View** action that opens a **side drawer** with the full product details (per the example
   screenshot `public/Screenshot 2026-06-20 090945.png`: a card with color dots, a "QUICK VIEW"
   button on the image, price, and "ADD TO CART").
4. **Hover image-swap** — when a product has more than one image, hovering the card image shows the
   next image (a swap, **not** a zoom).

This documents how colors, variants, and images currently work so the Plan can add the above.

## Summary
- **Colors are name-only.** The `Colors` lookup table has `Id, Name, CreatedAt` — **no hex / RGB /
  swatch column**. The storefront color picker renders the **text name** in a bordered button
  (`AddToCart.tsx:121-140`); there is no visual swatch and no automatic color-from-name mapping.
- **Images are per-product, not per-color.** The `ProductImages` table has **`ProductId` only — no
  `ColorId`** (`db/12_ecommerce.sql:36-44`). All images belong to the product as a whole. The PDP
  gallery shows that single shared set (`ProductGallery.tsx`); selecting a color in `AddToCart` does
  **not** change the gallery. Admin uploads one shared image set per product
  (`catalog/actions.ts:setProductImages`).
- **The variant model already carries color per variant.** `ProductVariants` rows are Size × Color
  (`ColorId`, `SizeId`, `Qty`, prices). `getProductVariants()` returns each variant with its
  `ColorId`/`ColorName` (`storefront.ts`), and `AddToCart` derives the in-stock color list from
  those variants — so the **set of colors per product is already known**, just not visually styled
  or linked to images.
- **Product cards are minimal.** `ProductCard.tsx` is a plain `<Link>` to the PDP showing image +
  name + price + discount badge. It has **no color swatches, no Quick View, and no hover image
  swap** (only a CSS `scale-105` zoom-in on hover, `ProductCard.tsx:20`). The card receives a
  `StoreProduct` which has **no colors array and no image list** (`storefront.ts:StoreProduct`).
- **No drawer/modal component exists** anywhere in the storefront (`src/components/shop/`); a Quick
  View side drawer would be net-new. The admin has its own modal pattern (full-screen overlay), not
  reusable on the light storefront.
- **The gallery does not zoom** today — it's a main image + clickable thumbnails
  (`ProductGallery.tsx`). So the "don't zoom" constraint matches current behavior; only the
  **card** has a hover zoom (`scale-105`) which is the thing the user wants replaced with a swap.

## Detailed Findings

### Data model (DB `InvFin`)
- `Colors` — `Id (uniqueidentifier)`, `Name (nvarchar 50)`, `CreatedAt`. **No hex/swatch column.**
  (Confirmed via schema introspection in the prior research doc.)
- `ProductVariants` — `Id, ProductId, SizeId (NULL), ColorId (NULL), Qty, SellingPrice (NULL),
  CostPrice (NULL), CreatedAt`. Color lives per variant.
- `ProductImages` — `Id, ProductId, Url (nvarchar 500), SortOrder, CreatedAt`
  (`db/12_ecommerce.sql:36-44`). **`ProductId` only — no `ColorId`**, and an index
  `IX_ProductImages_ProductId`. Primary thumbnail is mirrored to `Products.ImageUrl`.
- `Products` — has `ImageUrl` (primary), `Description`, `CompareAtPrice`, `IsActive`, `IsFeatured`,
  `Slug`, `SortOrder` (added in `db/12_ecommerce.sql`).

### Admin: image upload (per product, shared across colors)
- `src/app/(main)/catalog/actions.ts` — `setProductImages(productId, urls[])` deletes all
  `ProductImages` for the product and re-inserts the new list, then sets `Products.ImageUrl` to the
  first (`setProductImages`). It is **keyed by product only**; there is no color dimension.
- `src/app/(main)/catalog/page.tsx` — `ProductEditModal` uploads images via `/api/upload`
  (`folder=products`), supports reorder/remove, and calls `setProductImages`. Color management for
  the product is **not** part of this screen; colors/variants are created in the Stocks page
  (`stocks/actions.ts` `quickStock`, which creates `ProductVariants` per Size/Color).
- `/api/upload` (`src/app/api/upload/route.ts`) accepts a `folder` field restricted to
  `products|categories|slips|store|misc` — there is no per-color folder concept, but the handler is
  generic enough to store any image and return a URL.

### Storefront: color picker (text only, no swatch, no image link)
- `src/components/shop/AddToCart.tsx`:
  - `:28-29` `hasSizes`/`hasColors` derived from variants.
  - `:43-50` `colors` memo = unique in-stock colors for the selected size, each `{ id, name,
    inStock }` — **name only, no hex**.
  - `:121-140` renders each color as a bordered **text button** showing `c.name`; selecting sets
    `colorId`. Selecting a color updates the resolved `variant` (`:52-58`) for price/stock — but has
    **no effect on the gallery** (the gallery is a sibling in the PDP, not wired to `colorId`).
  - The cart line stores `color: variant.ColorName` (`:81`) — text only.

### Storefront: PDP gallery (shared images, thumbnails, no color filter, no zoom)
- `src/components/shop/ProductGallery.tsx` — client component; `images: string[]` + `name`. Shows a
  main image (`object-cover`) and a row of thumbnail buttons that set the active index. **No color
  awareness, no hover-swap, no zoom.** It receives the product's full image list.
- `src/app/(shop)/product/[slug]/page.tsx` — renders `<ProductGallery images={product.Images} .../>`
  beside `<AddToCart .../>`. `product.Images` comes from `getProductBySlug` (all product images).
  The two components are **independent** — selecting a color in AddToCart cannot change the gallery
  because they don't share state and images aren't tagged by color.

### Storefront: product card (no colors, no quick view, hover = zoom)
- `src/components/shop/ProductCard.tsx` — a single `<Link href="/product/[slug]">` with:
  image (`:17-21`, hover effect is `group-hover:scale-105` — a **zoom**, the behavior to replace),
  discount badge (`:25-29`), out-of-stock overlay (`:30-34`), category, name, price (`:36-44`).
  **No color swatches, no Quick View button, no second-image hover swap.**
- `ProductCard` is used by: home rows (`(shop)/page.tsx`), `shop` listing
  (`(shop)/shop/page.tsx`), `category/[slug]`, `deals`, and PDP "related" — so any card change
  propagates everywhere.

### Storefront: the product type fed to cards (no colors/images)
- `src/lib/storefront.ts` — `StoreProduct` = `Id, Name, Slug, ImageUrl, SellingPrice,
  CompareAtPrice, CategoryName, CategorySlug, Stock`. **No colors[], no images[].** All list queries
  (`getFeaturedProducts`, `getDeals`, `getNewProducts`, `searchProducts`, `getActiveCategories`,
  `getRelatedProducts`) select via the shared `PRODUCT_SELECT` and return only the primary
  `ImageUrl`. So cards currently cannot show swatches or a hover image without new query fields.
- `getProductBySlug` returns `StoreProductDetail` = `StoreProduct + Description + CategoryId +
  Images[]` (Images = all `ProductImages` urls, falling back to `ImageUrl`).
- `getProductVariants(productId)` returns `StoreVariant[]` = `VariantId, SizeId, SizeName, ColorId,
  ColorName, Qty, SellingPrice` — the source of the per-product color set.

### What's missing for each requested feature (as gaps, not proposals)
- **Per-color images**: no `ProductImages.ColorId` column; no admin UI to group images by color; no
  query to fetch images for a color; gallery not wired to selected color.
- **Auto color swatch**: no hex anywhere; nothing maps a color name → a CSS color; picker is text.
- **Card swatches**: `StoreProduct` carries no colors; card renders none.
- **Quick View drawer**: no drawer component; card is a bare link; no "fetch full details for a
  product id" lightweight endpoint for a drawer (only full-page `getProductBySlug`).
- **Hover image-swap**: card has one image and a zoom hover; no second image is fetched or swapped.

## Code References
- `db/12_ecommerce.sql:36-44` — `ProductImages` table (ProductId only; no ColorId).
- `src/app/(main)/catalog/actions.ts` — `setProductImages` (per-product replace) + product/category
  storefront CRUD.
- `src/app/(main)/catalog/page.tsx` — admin image upload modal (`ProductEditModal`).
- `src/app/api/upload/route.ts` — generic upload handler (folder allow-list).
- `src/components/shop/AddToCart.tsx:43-50,121-140` — color list + text-only color buttons.
- `src/components/shop/ProductGallery.tsx` — shared-image gallery, thumbnails, no zoom/no color.
- `src/components/shop/ProductCard.tsx:17-21` — card image with `scale-105` hover zoom; no swatches.
- `src/lib/storefront.ts` — `StoreProduct` (no colors/images), `PRODUCT_SELECT`, `getProductBySlug`
  (`Images[]`), `getProductVariants` (`ColorName`).
- `src/app/(shop)/product/[slug]/page.tsx` — wires Gallery + AddToCart (independent state).

## Architecture / Conventions Observed
- Storefront read helpers live in `src/lib/storefront.ts` (raw `mssql`, server components); the PDP
  is a server component composing a server `ProductGallery`-input + the client `AddToCart`.
- Images are stored on disk under `public/uploads/<folder>/` via `/api/upload`, URLs persisted in
  `ProductImages`/`Products.ImageUrl`. No external image service.
- Colors/sizes are flat lookups (`Colors`, `Sizes`); variants (`ProductVariants`) are the
  Size×Color join carrying stock + price. Color identity is the `Colors.Name` string.
- Cards are pure server components (a `<Link>`); any interactivity (Quick View, hover swap, swatch
  click) would require a client component, matching the existing `AddToCart`/`CartContext` pattern.
- The storefront has **no drawer/modal primitive**; toasts via `react-hot-toast`, icons via
  `lucide-react`, Tailwind, `primary` = `#F54927`.

## Related Prior Work (from workflow/)
- `workflow/research/2026-06-19-ecommerce-storefront-transformation.md` — original storefront
  research (schema, auth, orders).
- `workflow/plans/2026-06-19-ecommerce-storefront-transformation.md` — the implemented storefront
  plan (status: shipped) + its "Post-ship enhancements" (server-rendered PDP price, auto-account).
  This new topic builds directly on the catalog/PDP/card surfaces that plan created.

## Open Questions (for the Plan phase, not decided here)
- Color → swatch source: derive a hex from the color **name** (named-CSS-color map, fails on custom
  names like "Navy Marl") vs. add a `Colors.Hex` column the admin sets vs. sample the color from the
  first uploaded image. Which is the source of truth?
- Per-color images: add `ProductImages.ColorId (NULL)` (NULL = applies to all colors / product-level)
  vs. a separate table. How do products with size-only or no variants behave?
- Admin UX: where colors get their images — extend the Catalog product modal (group uploads by the
  product's existing colors from `ProductVariants`) vs. a new screen.
- Quick View data: reuse `getProductBySlug` (+variants) for the drawer vs. a lighter
  `getQuickView(productId)`; cards currently only have a slug/id.
- Hover image: fetch a 2nd image per card (extend `StoreProduct`/`PRODUCT_SELECT` with a secondary
  `HoverImageUrl` or a small images array) — how many images to ship to list pages for performance.
- Cart display: should the cart/order line item store the color swatch/hex too, or keep name only?
