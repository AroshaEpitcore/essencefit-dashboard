---
date: 2026-07-03
topic: "Gallery Management: admin CRUD for customer gallery items (artwork + final product images), home page section, dedicated gallery page with lightbox"
repo_commit: c307423
status: complete
tags: [research, gallery, storefront, admin, uploads, data-layer]
---

# Research: Gallery Management feature

> Note: the `/research` skill is written for the 3-repo Maraebiz workspace.
> This project is the single-repo **essencefit-dashboard** Next.js 16 app
> (`invfin-web`), so sections are adapted to this repo's layers
> (DB → data layer → admin → storefront), following the convention set in
> `workflow/research/2026-06-26-customer-reviews.md`.

## Research Question

How should a Gallery Management feature fit this codebase? Admin CRUD page for
gallery items (customer name, customer-submitted artwork image, multiple final
product images, optional caption, featured flag); home page latest-items
section with a "View More" link; dedicated responsive gallery page with
lightbox, lazy loading, search/filter, pagination.

## Summary

Nothing gallery-specific exists today, but the codebase already contains a
near-complete template for every part of the feature:

- **Customer Reviews** (June 2026) is the closest existing feature and models
  the whole stack: a parent table + child image table in Postgres, `"use
  server"` actions for admin CRUD, a single-file client admin page with
  multi-image upload, a published/sort-order publishing model, a storefront
  read function, and a home page display section.
- **`/api/upload`** already handles validated multi-image uploads to Supabase
  Storage with a folder whitelist (a `gallery` folder is not yet on the list).
- **`ProductGallery.tsx`** already implements a full-screen lightbox with
  next/prev, keyboard nav, and scroll lock — but it is component-local, not a
  shared module.
- The home page has **no "Custom Orders" section** by that name today; the
  custom-order entry point is the "Customize" mega-menu → `/customize` DTF
  page. The home page is a server component assembled from section components
  (`ProductSlider` takes a `title` + `href` "view all" pattern).
- There is **no pagination, no search-by-name, and no `loading="lazy"`**
  anywhere in the storefront today — the shop page filters server-side via
  `searchParams` and renders the full result set.

## Detailed Findings

### Stack / architecture

- Next.js 16 App Router (`next dev --turbopack`), React 19, Tailwind 3,
  `lucide-react` icons, `react-hot-toast` (`package.json:10-27`).
- Route groups: `(auth)` login, `(main)` admin dashboard, `(shop)` public
  storefront (`src/app/`).
- Images are plain `<img>` tags with an eslint-disable comment throughout —
  `next/image` is not used and `next.config.ts` has no `images` config.
- Deployed on Vercel; apex-domain redirect in `next.config.ts:5-18`
  (essencefits.com).

### Database (PostgreSQL / Supabase)

- Runtime DB is PostgreSQL on Supabase; **`db/pg/schema.sql` is
  authoritative**. The numbered `db/NN_*.sql` files are MSSQL-parity docs only
  (stated in `db/23_customer_reviews.sql:7-8`).
- Access layer is an mssql-compatible facade over `pg`: `src/lib/db.ts`
  wraps `src/lib/sqlShim.ts`; callers use
  `pool.request().input("X", sql.Type, v).query("... @X")` and read
  `res.recordset`. Inserts return ids via `RETURNING Id`
  (`src/app/(main)/reviews/actions.ts:124-127`).
- **Parent + child image table precedent** — `reviews` / `reviewimages`
  (`db/pg/schema.sql:349-388`): child rows hold `url` + `sortorder`, indexed
  by parent id. Publishing model: `IsPublished BIT` + `SortOrder INT`
  (`db/23_customer_reviews.sql:19-20`).
- **Featured-flag precedent** — `products.isfeatured boolean NOT NULL DEFAULT
  false` (`db/pg/schema.sql:77`), consumed by
  `getFeaturedProducts()` (`src/lib/storefront.ts:102`).

### Upload pipeline

- `POST /api/upload` (`src/app/api/upload/route.ts`): multipart form with
  `file` + `folder`; validates MIME (JPG/PNG/WEBP/GIF images, 5MB cap;
  PDFs only for `designs`, 25MB), uploads to a public Supabase Storage bucket
  via the Storage REST API with the service-role key, returns
  `{ url, kind }` (the public CDN URL).
- Folder whitelist `SAFE_FOLDERS` at `route.ts:26`:
  `products, categories, slips, store, hero, designs, reviews, misc` — no
  `gallery` entry yet; unknown folders fall back to `misc`.
- Multi-image upload UX precedent: the reviews admin uploads several files in
  parallel with `Promise.all` and appends URLs to form state
  (`src/app/(main)/reviews/page.tsx:117-129`).

### Admin dashboard pattern (model: Customer Reviews)

- **Server actions** — `src/app/(main)/reviews/actions.ts` (`"use server"`):
  `getAdminReviews` (list + child-image count), `getReviewForEdit` (parent +
  ordered image URLs), `saveReview` (insert/update parent, then
  delete-and-reinsert the ordered child image set, `actions.ts:130-139`),
  `deleteReview` (children first, then parent). Validation is done in the
  action with thrown `Error`s (`actions.ts:93-95`).
- **Admin page** — `src/app/(main)/reviews/page.tsx`: one `"use client"` file;
  editor card + list card; shared Tailwind `input`/`card` class strings
  (`page.tsx:26-28`); uploads via `/api/upload` with a folder name
  (`page.tsx:16-24`); toasts for every outcome; `confirm()` before delete;
  edit loads the record into the top form and scrolls up (`page.tsx:131-150`).
- **Sidebar nav** — items array at `src/components/layout/Sidebar.tsx:35-62`
  (Reviews entry at `:44`); admin auth is a client-side guard in
  `src/app/(main)/layout.tsx` via `useAuth()` (`canAccess` + login redirect).

### Storefront patterns

- **Home page** — `src/app/(shop)/page.tsx`: server component, `Promise.all`
  data fetch (`page.tsx:31-39`), sections composed from components.
  `ProductSlider` takes `title` + `href` for the "view all" link
  (`page.tsx:46`). `export const revalidate = 60` is present but currently
  ineffective (cookie read in `(shop)/layout.tsx` forces dynamic rendering —
  documented at `page.tsx:11-17`).
- **No "Custom Orders" section exists on the home page.** Custom-order entry
  points are the "Customize" mega-menu in
  `src/components/shop/StoreHeader.tsx:194-198, 379-427` and the `/customize`
  DTF order page (`src/app/(shop)/customize/` — `page.tsx`,
  `CustomizeForm.tsx`, `actions.ts`).
- **Storefront read functions** live in `src/lib/storefront.ts`; the reviews
  one is `getLatestReviews(limit)` at `:562-577` — filters `IsPublished`,
  orders by `SortOrder, CreatedAt DESC`, `LIMIT @n`, then batch-attaches child
  images via `attachReviewImages`.
- **Home display section** — `src/components/shop/ReviewsSection.tsx`:
  black rounded panel, `grid` and `carousel` (CSS marquee) variants, renders
  nothing when empty.
- **Lightbox** — `src/components/shop/ProductGallery.tsx:163-220`: fixed
  full-screen `bg-black/90` overlay with next/prev buttons, image counter,
  Escape/arrow keyboard nav, and body scroll lock (`:57-72`). It is local to
  `ProductGallery`; `DesignPicker.tsx` has its own separate lightbox — there
  is no shared lightbox component.
- **Search/filter** — the shop page reads `searchParams` server-side and
  passes a `ProductQuery` to `searchProducts()`
  (`src/app/(shop)/shop/page.tsx:14-29`); the filter UI is the client
  component `ShopFilters` that rewrites the URL query. **No pagination or
  "load more" exists anywhere** — full result sets are rendered.
- **Lazy loading** — no `loading="lazy"` attributes exist in the codebase.
- **SEO** — per-page `generateMetadata` (`(shop)/page.tsx:19-28`), site
  constants in `src/lib/seo.ts`, and `src/app/sitemap.ts` mixing static URLs
  with DB-driven product/category URLs (`sitemap.ts:10-36`). `/customize` is
  in the sitemap at priority 0.6; a new public page would follow this pattern.

## Code References

- `db/pg/schema.sql:349-388` — reviews + reviewimages tables (parent/child model)
- `db/pg/schema.sql:77` — `products.isfeatured` featured-flag precedent
- `src/lib/db.ts:10-16` — mssql-style pool facade over pg
- `src/app/api/upload/route.ts:26` — `SAFE_FOLDERS` whitelist (no `gallery` yet)
- `src/app/api/upload/route.ts:30-98` — upload validation + Supabase Storage put
- `src/app/(main)/reviews/actions.ts:92-142` — save with delete-and-reinsert child images
- `src/app/(main)/reviews/page.tsx:117-129` — parallel multi-image upload UX
- `src/components/layout/Sidebar.tsx:35-62` — admin nav items array
- `src/app/(shop)/page.tsx:30-70` — home page section composition
- `src/components/shop/StoreHeader.tsx:194-198` — "Customize" nav entry (closest thing to a Custom Orders section)
- `src/lib/storefront.ts:562-577` — `getLatestReviews` published-items read pattern
- `src/components/shop/ReviewsSection.tsx` — home page section component (grid/carousel)
- `src/components/shop/ProductGallery.tsx:163-220` — existing lightbox implementation
- `src/app/(shop)/shop/page.tsx:14-29` — searchParams-driven server-side filtering
- `src/app/sitemap.ts:10-15` — static sitemap entries for public pages

## Architecture / Conventions Observed

- Admin CRUD = one `(main)/<feature>/page.tsx` client page + colocated
  `actions.ts` server actions; no API routes for admin data (only `/api/upload`
  and `/api/health` exist).
- Multi-image sets are stored as an ordered child table and replaced
  wholesale on save (delete + reinsert with `SortOrder = index`).
- Public visibility = `IsPublished` flag + `SortOrder`, filtered in the
  storefront read function, never in the component.
- Storefront reads live in `src/lib/storefront.ts` and return typed rows;
  components receive data as props from server components.
- Plain `<img>` tags (with eslint-disable), Tailwind-only styling, `rounded-lg`
  buttons (per user preference), black section panels on the home page.

## Related Prior Work (from workflow/)

- `workflow/research/2026-06-26-customer-reviews.md` +
  `workflow/plans/2026-06-26-customer-reviews.md` — the feature this one
  should be modeled on (same parent/child image shape, admin CRUD, home
  section).
- `workflow/plans/2026-06-23-supabase-migration.md` — why uploads go to
  Supabase Storage and the DB runs through the pg shim.
- `workflow/research/2026-06-19-ecommerce-storefront-transformation.md` —
  original storefront structure ((shop) route group, home page sections).

## Open Questions

- **"Keep the existing Custom Orders section"** — no home page section with
  that name exists at `c307423`. The user most likely means the "Customize"
  nav/mega-menu and `/customize` page (which would stay untouched), but this
  should be confirmed in the plan phase.
- Whether the gallery's customer-submitted artwork can be a PDF (like DTF
  `designs` uploads) or images only — affects upload folder rules.
- Route naming for the public page (`/gallery` under `(shop)`) and whether it
  needs a nav/footer link — plan phase decision.
- Pagination/"load more" and name search have no existing precedent — the
  plan will introduce the first instance of each.
