---
date: 2026-07-03
slug: gallery-management
status: shipped   # user pre-approved plan→implement→deploy in one run
surfaces: [db, data-layer, admin, storefront]
research: workflow/research/2026-07-03-gallery-management.md
estimated_manual_effort: 2h 20m
---

# Gallery Management — Implementation Plan

## Overview
Add an admin-managed "Custom Orders Gallery": each gallery item records a
customer's name, the artwork the customer submitted, multiple photos of the
final customized product we delivered, an optional caption, and featured /
published flags. The storefront shows the latest items in a new home page
section (with a "View More" link) and a dedicated `/gallery` page with a
responsive grid, customer-name search, load-more, and a full-screen lightbox.

## Estimated Manual Effort
**2h 20m** — total human-in-the-loop time only: overviewing/reviewing each
phase's diff, running the manual verification steps, plus the final
`/validate`. Implementation is done by Claude Code, so no development hours
are counted. Includes a 10% buffer.

## Current State
- No gallery feature exists. The **Customer Reviews** feature is the model for
  every layer (see research doc): parent+child image tables
  (`db/pg/schema.sql:349-388`), admin CRUD via `"use server"` actions
  (`src/app/(main)/reviews/actions.ts`), single-file client admin page
  (`src/app/(main)/reviews/page.tsx`), storefront read (`src/lib/storefront.ts:562`),
  home section component (`src/components/shop/ReviewsSection.tsx`).
- Runtime DB is Postgres (Supabase); `db/pg/schema.sql` is authoritative and
  `node db/pg/apply.mjs <sql>` applies SQL to the live DB via `.env.local`.
  Numbered `db/NN_*.sql` files are MSSQL parity docs (latest: `25`).
- Uploads: `POST /api/upload` with allow-listed `folder`
  (`src/app/api/upload/route.ts:26` — no `gallery` entry yet).
- Lightbox pattern: `src/components/shop/ProductGallery.tsx:163-220`
  (component-local; will be adapted, not extracted).
- Home page: `src/app/(shop)/page.tsx` — server component, sections composed
  from components. **No "Custom Orders" home section exists**; the "Customize"
  nav → `/customize` DTF page stays untouched (resolves the research open
  question: nothing to "keep" on the home page — we only add).
- No pagination/search-by-name/`loading="lazy"` precedent exists — this
  feature introduces the first instances.

## Desired End State
- Admin → **Gallery** page: create/edit/delete gallery items with customer
  name, one artwork image, multiple final-product images, optional caption,
  featured + published toggles, sort order.
- Home page: "Custom Orders" gallery section showing the latest published
  items (featured first) with a "View More" → `/gallery` button; hidden when
  there are no items.
- `/gallery`: responsive card grid (customer name, artwork thumbnail, final
  product images), customer-name search, "Load more", lazy-loaded images,
  SEO metadata + sitemap entry, and a mobile-friendly lightbox with
  next/previous navigation over each item's images.
- `npx tsc --noEmit` and `npm run build` green; committed and pushed to
  `main` (Vercel auto-deploy).

## What We're NOT Doing
- No public submission — gallery items are admin-entered only.
- No masonry layout (plain responsive grid, matching the site's card idiom).
- No numbered pagination — "Load more" via an incremental `?show=` param.
- No image resizing/thumbnail generation server-side (Supabase CDN URLs are
  used as-is, same as every other image in the app); `loading="lazy"` is the
  optimization.
- No linking of gallery items to products/orders (free-standing entries).
- No changes to the `/customize` page or Customize nav.

## Touchpoints per surface
> Single repo. Contract: admin write (`gallery/actions.ts`) ⇄ storefront read
> (`storefront.ts` helpers) ⇄ home section + `/gallery` page, keyed by
> `galleryitems.id` with images in `galleryimages`.
- **DB**: new `galleryitems` + `galleryimages` tables in `db/pg/schema.sql`;
  parity file `db/26_gallery.sql`; applied live via `node db/pg/apply.mjs`.
- **Data layer**: `src/lib/storefront.ts` — `GalleryItem` type,
  `attachGalleryImages()`, `getLatestGalleryItems()`, `getGalleryItems()`
  (search + limit); `src/lib/columnCase.ts` — register new columns.
- **Upload**: add `"gallery"` to `SAFE_FOLDERS` (`src/app/api/upload/route.ts:26`).
- **Admin**: `src/app/(main)/gallery/page.tsx` + `actions.ts`; Sidebar nav item.
- **Storefront**: `src/components/shop/GalleryCard.tsx`, `GalleryLightbox.tsx`,
  `GallerySection.tsx`; new `src/app/(shop)/gallery/page.tsx`; home page
  section; StoreHeader nav link; `src/app/sitemap.ts` entry.
- **Tenancy note**: single-tenant app — no tenant filter applies.

## Phase 1: Database + data layer

### Changes

#### Postgres schema — `db/pg/schema.sql`
Append (mirror the `reviews`/`reviewimages` conventions):
```sql
-- Admin-managed custom-orders gallery: each item is a customer's order with
-- the artwork they sent (artworkurl) and photos of the delivered product
-- (galleryimages child table).
CREATE TABLE IF NOT EXISTS galleryitems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customername text NOT NULL,
  artworkurl text,
  caption text,
  isfeatured boolean NOT NULL DEFAULT false,
  ispublished boolean NOT NULL DEFAULT true,
  sortorder integer NOT NULL DEFAULT 0,
  createdat timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS galleryimages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  galleryitemid uuid NOT NULL,
  url text NOT NULL,
  sortorder integer NOT NULL DEFAULT 0,
  createdat timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_galleryimages_galleryitemid ON galleryimages (galleryitemid);
```

#### Parity migration — `db/26_gallery.sql` (new, MSSQL dialect, idempotent)
Mirror in numbered-migration style (matches `db/23_customer_reviews.sql`).
Not executed against the live DB.

#### Apply to live Supabase
`node db/pg/apply.mjs <new-tables sql>` (scratchpad file with just the new
statements), then verify with `SELECT to_regclass('public.galleryitems'),
to_regclass('public.galleryimages');`.

#### Column casing — `src/lib/columnCase.ts`
Register any missing lowercase→Pascal entries: `artworkurl→ArtworkUrl`,
`caption→Caption`, `galleryitemid→GalleryItemId` (`customername`,
`isfeatured`, `ispublished`, `sortorder`, `createdat`, `url` should already
exist — verify).

#### Data layer — `src/lib/storefront.ts`
```ts
export type GalleryItem = {
  Id: string;
  CustomerName: string;
  ArtworkUrl: string | null;
  Caption: string | null;
  IsFeatured: boolean;
  CreatedAt: string;
  Images: string[];   // final product photos, ordered
};
async function attachGalleryImages(pool, rows): Promise<GalleryItem[]>; // batched, mirrors attachReviewImages
export async function getLatestGalleryItems(limit = 6): Promise<GalleryItem[]>;
// ispublished = true, ORDER BY isfeatured DESC, sortorder, createdat DESC
export async function getGalleryItems(opts: { q?: string; limit: number }): Promise<{ items: GalleryItem[]; total: number }>;
// same ordering; q = ILIKE on customername; total for the Load-more button
```

### Success Criteria
#### Automated (the deterministic gate — must be green)
- [x] Type-checks: `npx tsc --noEmit`
- [x] Production build: `npm run build`
#### Manual (human verification)
- [x] `to_regclass` returns non-null for both tables on live Supabase
      (verified 2026-07-03: both return the table names).

---

## Phase 2: Admin Gallery page (CRUD)

### Changes

#### Upload allow-list — `src/app/api/upload/route.ts`
Add `"gallery"` to `SAFE_FOLDERS`.

#### Server actions — `src/app/(main)/gallery/actions.ts` (new, `"use server"`)
Mirror `reviews/actions.ts`: `getAdminGalleryItems()` (list + image count),
`getGalleryItemForEdit(id)`, `saveGalleryItem(input)` (upsert parent; replace
`galleryimages` with the ordered set), `deleteGalleryItem(id)` (children
first). Validation: customer name required; at least one final-product image
required.

#### Admin page — `src/app/(main)/gallery/page.tsx` (new, client)
Mirror `reviews/page.tsx` exactly (editor card + list card, toasts,
`confirm()` delete): customer name input; **artwork** single upload (like the
avatar slot, square preview); **final product images** multi-upload (like the
review gallery strip); caption textarea (optional); Featured + Published
checkboxes; sort order number. Uploads use `folder: "gallery"`.

#### Nav — `src/components/layout/Sidebar.tsx`
Add `{ href: "/gallery", label: "Gallery", icon: Images }` (lucide `Images`)
after the Reviews entry.

> NOTE (implementation): the admin route moved to `(main)/store-gallery/`
> (sidebar label still "Gallery") — `(main)/gallery` would collide with the
> public `(shop)/gallery` page since route groups don't affect URL paths.

### Success Criteria
#### Automated (the deterministic gate — must be green)
- [x] Type-checks: `npx tsc --noEmit`
- [x] Production build: `npm run build`
#### Manual (human verification)
- [ ] Admin → Gallery in the sidebar; create an item with name, artwork, ≥2
      final images, caption, featured on; it lists with the right image count.
- [ ] Edit (change caption, remove an image) persists; delete works;
      published-off hides it from the storefront (verified in Phase 3).

---

## Phase 3: Storefront — /gallery page + home section

### Changes

#### Shared components — `src/components/shop/`
- `GalleryLightbox.tsx` (client) — full-screen overlay adapted from
  `ProductGallery.tsx:163-220`: next/prev, counter, Escape/arrow keys, body
  scroll lock, tap-friendly buttons. Props: `images: string[]`,
  `startIndex`, `onClose`.
- `GalleryCard.tsx` (client) — card showing the first final-product image
  (hover swaps to the second when present), customer name, optional caption,
  a small "Customer's artwork" inset thumbnail, and an image-count badge.
  Clicking opens `GalleryLightbox` over `[...finalImages, artwork?]`.
  All `<img>` use `loading="lazy"`. Subtle hover scale via Tailwind
  transitions (site idiom).
- `GallerySection.tsx` — home section styled like `ReviewsSection` (black
  rounded panel, uppercase heading + primary underline): grid of up to 6
  `GalleryCard`s + a "View the full gallery" `rounded-lg` CTA → `/gallery`.
  Returns `null` when empty.

#### Gallery page — `src/app/(shop)/gallery/page.tsx` (new, server)
- `generateMetadata` (title "Custom Orders Gallery", description, canonical
  `/gallery`); `export const dynamic = "force-dynamic"` (matches shop page).
- Reads `searchParams`: `q` (customer-name search) and `show` (item cap,
  default 12). Fetches `getGalleryItems({ q, limit: show })`.
- Renders: heading + a small GET search form (input name=`q`), responsive
  grid (1/2/3/4 cols like the shop grid) of `GalleryCard`s, empty state, and
  a "Load more" link → `?q=...&show=show+12` (rendered only while
  `items.length < total`, with `scroll={false}`).

#### Home page — `src/app/(shop)/page.tsx`
Add `getLatestGalleryItems(6)` to the `Promise.all` and render
`<GallerySection items={...} title="Custom orders, made real" />` directly
above the reviews section, matching its `max-w-[1920px]` wrapper.

#### Nav — `src/components/shop/StoreHeader.tsx`
Add a plain "Gallery" link (no dropdown) to the desktop nav and the mobile
menu list, pointing to `/gallery`.

#### SEO — `src/app/sitemap.ts`
Add `{ url: `${BASE}/gallery`, priority: 0.6, changeFrequency: "weekly" }`.

### Success Criteria
#### Automated (the deterministic gate — must be green)
- [x] Type-checks: `npx tsc --noEmit`
- [x] Production build: `npm run build`
#### Manual (human verification)
- [ ] Home shows the gallery section (featured first) with working View More;
      hidden when no published items.
- [ ] `/gallery` grid is responsive; search by customer name filters; Load
      more reveals more items; lightbox opens with next/prev + keyboard +
      mobile tap targets; artwork thumbnail visible on cards.
- [ ] Unpublished items never appear.

---

## Phase 4: Ship
- Re-run the full gate (`npx tsc --noEmit`, `npm run build`, `npx vitest run`
  if the suite is runnable).
- Commit all changes and push to `main` → Vercel auto-deploys
  (essencefits.com).

### Success Criteria
- [ ] Gate green; pushed; Vercel deployment succeeds.

## Testing Strategy
- No automated test suite covers this area; each phase is gated by
  `npx tsc --noEmit` + `npm run build`, plus the manual steps above.
- Seed: create 2–3 gallery items in admin (one featured, one with no caption,
  one unpublished) so home ordering, caption fallback, and the
  published filter can all be verified in one pass.

## References
- Research: `workflow/research/2026-07-03-gallery-management.md`
- Model feature: `workflow/plans/2026-06-26-customer-reviews.md` (shipped)
- Child-table + batched fetch: `db/pg/schema.sql:349`, `src/lib/storefront.ts:562`
- Admin CRUD model: `src/app/(main)/reviews/actions.ts`, `reviews/page.tsx`
- Lightbox: `src/components/shop/ProductGallery.tsx:163-220`
- Search-by-params: `src/app/(shop)/shop/page.tsx:14`
- Industry standard considered: "customer gallery / lookbook" sections on
  print-on-demand stores typically pair the customer's submitted design with
  finished-product photos in a lightbox grid with lazy loading and
  incremental loading — this plan follows that pattern while reusing the
  repo's reviews conventions (admin-curated, publish flag, child image table).
