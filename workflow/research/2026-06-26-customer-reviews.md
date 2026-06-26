---
date: 2026-06-26
topic: "Customer reviews: admin-managed reviews shown on PDP, category, and home pages"
repo_commit: 70c0701
status: complete
tags: [research, reviews, storefront, admin, data-layer, uploads]
---

# Research: Customer Reviews feature

> Note: the `/research` skill is written for the 3-repo Maraebiz workspace.
> This project is the single-repo **essencefit-dashboard** Next.js 16 app, so the
> section structure below is adapted to this repo's layers (DB → data layer →
> admin → storefront), not Maraebiz's backend/app/site split.

## Research Question
Add a customer-reviews feature: a **separate admin page** to add reviews
(optional customer photo with a name-initials fallback, name, message, and
**multiple image uploads**), where each review is **assigned to a product**.
On the storefront, show: the product's reviews **on its PDP**, reviews **on the
category page** (category auto-derived from the chosen product), and **all
reviews on the home page**. Any surface with **no reviews must not render**.

## Summary
The codebase already has every building block this feature needs; nothing about
reviews exists yet. The work slots cleanly into established patterns:

- **DB**: Postgres on Supabase. Tables live in `db/pg/schema.sql` (lowercase
  identifiers, `uuid` PKs via `gen_random_uuid()`); legacy MSSQL-dialect numbered
  migrations live in `db/NN_*.sql`. A `reviews` table (+ a `reviewimages` child
  table, mirroring `productimages`) is the natural shape.
- **Data layer**: `src/lib/storefront.ts` holds typed query helpers over the
  `pg`-backed mssql-shim (`getDb().request().input().query()`), with a batched
  child-row "attach" pattern (`attachColors`) that a review→images attach can copy.
  `src/lib/columnCase.ts` maps lowercase pg columns back to PascalCase and must be
  extended for any new columns the storefront reads.
- **Admin**: admin pages are `src/app/(main)/<name>/page.tsx` (client) + a
  colocated `actions.ts` (`"use server"`) doing direct `getDb` queries; nav is a
  static array in `src/components/layout/Sidebar.tsx`; the whole `(main)` group is
  auth-gated in `src/app/(main)/layout.tsx`. `catalog/` is the closest CRUD model.
- **Uploads**: `POST /api/upload` takes a `file` + `folder` (allow-listed) and
  returns `{ url, kind }`; multiple images = call it per file. A `"reviews"`
  folder must be added to the `SAFE_FOLDERS` allow-list.
- **Storefront render targets**: PDP (`product/[slug]/page.tsx`), category
  (`category/[slug]/page.tsx`), and home (`page.tsx`) are all `force-dynamic`
  server components that already fetch via `storefront.ts`, so each can gain a
  reviews block that returns `null` when empty.
- **Initials fallback** already exists: `AccountMenu.tsx:11` `initials(name)` +
  an avatar circle — reusable for the "no photo" case.
- **Category auto-derivation** is free: a review stores `productid`; joining
  `Products.CategoryId` yields the category, so the category page shows reviews
  for any product in that category without storing a category on the review.

## Detailed Findings

### Database (`db/`)
- Live schema is Postgres: `db/pg/schema.sql`. Child-table pattern to copy is
  `productimages` — `id uuid PK DEFAULT gen_random_uuid()`, `productid uuid NOT NULL`,
  `url text NOT NULL`, `sortorder int DEFAULT 0`, `createdat timestamp DEFAULT now()`
  (`db/pg/schema.sql:100`).
- Legacy numbered migrations are MSSQL-dialect and additive/idempotent, e.g.
  `db/15_new_arrivals.sql` (`IF COL_LENGTH(...) IS NULL ALTER TABLE ... ADD ...; GO`).
  The latest is `db/22_design_per_image.sql`; a new feature adds `db/23_*.sql` for
  parity, but the **runtime DB is Postgres**, so `db/pg/schema.sql` is the file
  that must actually carry the new tables.
- `Settings` table exists (`db/pg/schema.sql:258`) and is used as a generic
  key/value store (see Store Settings) — not needed for reviews, but it's the
  pattern if any review config (e.g. home-section title) is wanted.

### Data layer (`src/lib/`)
- `storefront.ts` is the storefront read layer. Key references:
  - `PRODUCT_SELECT` shared SELECT (`src/lib/storefront.ts:38`).
  - `attachColors()` — batched child-row fetch keyed by parent id, the exact
    pattern a `attachReviewImages()` would follow (`src/lib/storefront.ts:52`).
  - `getProductBySlug()` returns `CategoryId`, `CategoryName`, `CategorySlug`
    on the detail object (`src/lib/storefront.ts:360`) — the PDP already knows the
    product id + category for fetching/anchoring reviews.
  - `searchProducts()` and category lookups use `getCategoryBySlug` /
    `categorySlug` (`src/lib/storefront.ts:252`) — category page already resolves a
    category id/slug, which a `getReviewsByCategory(slug)` can join against.
- The DB facade is `src/lib/db.ts` → `getDb()` returning an mssql-style
  `request().input(name, type, value).query(text)` shim over `pg`
  (`src/lib/sqlShim.ts`). New queries follow this call shape.
- `src/lib/columnCase.ts` maps lowercase pg keys → PascalCase for the shim's
  `remapKeys` (e.g. `"isnewarrival": "IsNewArrival"` at `:142`). New review columns
  the storefront reads (e.g. `customername`, `imageurl`, `productid`) need entries
  here or they come back lowercase.

### Admin (`src/app/(main)/`)
- Nav is a static `navItems` array in `src/components/layout/Sidebar.tsx:34-60`
  (label + `href` + lucide icon). A "Reviews" entry is one array item; the route is
  a new `src/app/(main)/reviews/` folder.
- `(main)` pages are auth-gated centrally in `src/app/(main)/layout.tsx:27-43`
  (redirects to `/login` if not signed in; staff bounced from admin-only routes via
  `useAuth().canAccess`). `ADMIN_ONLY_ROUTES` lives in `src/lib/useAuth.ts`.
- CRUD model to mirror: `src/app/(main)/catalog/`. `catalog/actions.ts` is
  `"use server"`, imports `{ getDb, sql }`, and runs typed queries
  (`getCatalogProducts()` at `:38`, `getProductForEdit()` at `:57`). The admin page
  is a client component that calls these actions and uploads images.
- Store Settings (`src/app/(main)/store-settings/page.tsx`) shows the in-repo
  form-input styling conventions (the shared `input` class, textarea usage) for a
  consistent admin form.
- A **product picker** for "assign review to product" can reuse
  `getCatalogProducts()` (id + name + category) — no new query needed for the
  dropdown.

### Uploads (`src/app/api/upload/route.ts`)
- `POST /api/upload`, `runtime = "nodejs"`. Body: multipart `file` + `folder`.
  `folder` is validated against `SAFE_FOLDERS` (`:26`) — currently
  `products, categories, slips, store, hero, designs, misc`. **`"reviews"` must be
  added** or uploads fall back to `misc`.
- Images limited to 5MB, types JPG/PNG/WEBP/GIF (`:20-23`). Returns
  `{ url, kind }` with a public Supabase CDN URL (`:91-93`).
- Client usage pattern: the checkout `uploadSlip()` helper
  (`src/app/(shop)/checkout/page.tsx:14-22`) POSTs a `FormData` and reads
  `data.url`. **Multiple images** = call once per file (e.g. `Promise.all` over the
  selected `FileList`), then store the returned URLs as `reviewimages` rows.

### Storefront render targets (`src/app/(shop)/`)
- **PDP** — `product/[slug]/page.tsx`. Server component, `force-dynamic`. Has
  `product.Id` + category fields; renders `ProductView` then a conditional
  "You may also like" section (`:110`). A **Reviews section** drops in below the
  product (after `ProductView`/before or after related), fetching by `product.Id`.
- **Category** — `category/[slug]/page.tsx`. Resolves `cat` via
  `getCategoryBySlug(slug)` and lists products via `searchProducts({categorySlug})`.
  A **category Reviews section** fetches reviews joined through
  `Products.CategoryId = cat.Id`.
- **Home** — `page.tsx`. Composes Hero + sliders + `WeeklyMvp`. An **all-reviews
  section** is one more block in this list; it already conditionally renders
  sections (e.g. `deals.length > 0 && ...`), so the "hide when empty" rule matches
  existing style.
- **Reusable card patterns** for a tasteful default design:
  - Live-dot/tag pill component `src/components/shop/ProductTags.tsx` (recent) shows
    the badge/pill visual language.
  - Section heading style (uppercase + primary underline) in
    `src/components/shop/ProductSlider.tsx:38`.
  - Horizontal scroll-snap slider mechanics in `ProductSlider.tsx` (reusable for a
    reviews carousel).
  - Star icons: `lucide-react` (`Star`) is already a dependency.

### Cross-cutting connection points
- Admin write (`reviews/actions.ts` `createReview`) ⇄ storefront read
  (`storefront.ts` `getReviewsForProduct` / `...ByCategory` / `getLatestReviews`).
- Upload route `folder:"reviews"` ⇄ `reviewimages.url` rows ⇄ rendered `<img>` on
  each surface.
- `Products.CategoryId` is the single join that powers "category auto-derived from
  the selected product" — no denormalized category on the review.

## Code References
- `db/pg/schema.sql:100` — `productimages` child-table shape to mirror for `reviewimages`.
- `db/15_new_arrivals.sql` — additive idempotent migration style (MSSQL dialect).
- `src/lib/storefront.ts:52` — `attachColors` batched child-fetch pattern.
- `src/lib/storefront.ts:360` — `getProductBySlug` exposes `CategoryId/Name/Slug`.
- `src/lib/columnCase.ts:142` — lowercase→Pascal map to extend for review columns.
- `src/lib/sqlShim.ts` / `src/lib/db.ts` — query call-shape for new queries.
- `src/components/layout/Sidebar.tsx:34` — `navItems` array (add "Reviews").
- `src/app/(main)/layout.tsx:27` — admin auth gating for the new page.
- `src/app/(main)/catalog/actions.ts:38` — `"use server"` CRUD model + product list for the picker.
- `src/app/api/upload/route.ts:26` — `SAFE_FOLDERS` (add `"reviews"`); `:91` returns public URL.
- `src/app/(shop)/checkout/page.tsx:14` — client multipart upload helper pattern.
- `src/app/(shop)/product/[slug]/page.tsx:110` — PDP section insertion point.
- `src/app/(shop)/category/[slug]/page.tsx:21` — category page product/reviews fetch point.
- `src/app/(shop)/page.tsx` — home section composition + "hide when empty" idiom.
- `src/components/shop/AccountMenu.tsx:11` — `initials(name)` + avatar circle (no-photo fallback).
- `src/components/shop/ProductSlider.tsx:38` — section heading + scroll-snap carousel for review display.

## Architecture / Conventions Observed
- **Server components fetch via `storefront.ts`; client islands handle interaction.**
  Storefront pages are `force-dynamic` and read directly in the server component.
- **Admin = `(main)/<page>/page.tsx` (client) + `actions.ts` (`"use server"`)** with
  direct `getDb` queries; nav is a hand-maintained array; the group is auth-gated.
- **Postgres is the runtime DB**; `db/pg/schema.sql` is authoritative, the numbered
  `db/NN_*.sql` files are legacy MSSQL parity. New columns the storefront reads must
  be registered in `columnCase.ts`.
- **Child rows are fetched in a batched second query** keyed by parent id
  (`attachColors`), not per-row N+1.
- **Uploads go through one allow-listed route** returning a public CDN URL; the DB
  stores URLs, not blobs.
- **"Hide when empty"** is already idiomatic on the home page (`x.length > 0 && ...`).
- **Design language**: uppercase section titles with a `border-primary` underline,
  white/translucent pills, primary = `#F54927`, `lucide-react` icons.

## Suggested scope additions (beyond the original idea — for the Plan phase)
These are noted here as observations, not decisions:
- A **star rating (1–5)** per review (common for reviews; `Star` icon available) and
  an aggregate average shown on the PDP.
- An **approved/published toggle** + **sort order** on each review (admin moderates
  what's public), mirroring the `IsActive`/`SortOrder` convention on Products.
- **Edit/delete** in admin (full CRUD), not just create, to match `catalog/`.
- Optional **product/category/created-at** metadata line on each card so the home
  "all reviews" block can link back to the product.

## Open Questions
- **Rating**: include a 1–5 star rating, or message-only? (Affects schema + cards.)
- **Moderation**: should new reviews be visible immediately, or require an admin
  "published" flag before showing on the storefront?
- **Home placement/limit**: where in the home stack should "all reviews" sit, and
  how many (carousel vs. capped grid)?
- **Multiple-image display**: thumbnails with a lightbox, or inline strip? (A zoom
  lightbox already exists in `DesignPicker.tsx` to model.)
- **Migration delivery**: is the live Supabase schema applied from `db/pg/schema.sql`
  manually, or is there a runner? Confirm how `reviews`/`reviewimages` get created in
  production.

## Related Prior Work (from workflow/)
- `workflow/research|plans/2026-06-19-ecommerce-storefront-transformation.md` — the
  storefront/admin split and catalog conventions this feature extends.
- `workflow/research|plans/2026-06-20-color-images-and-quick-view.md` — multi-image
  per parent + `ProductImages`/`attachColors` precedent (closest analog to
  `reviewimages`).
- `workflow/plans/2026-06-23-supabase-migration.md` — why the runtime DB is Postgres
  and `db/pg/schema.sql` is authoritative.
- `workflow/research|plans/2026-06-23-customer-auth-and-navbar-refresh.md` —
  customer identity + the `initials()`/avatar pattern reused for the no-photo case.
```
