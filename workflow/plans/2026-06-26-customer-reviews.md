---
date: 2026-06-26
slug: customer-reviews
status: shipped   # draft | approved | implementing | shipped
surfaces: [db, data-layer, admin, storefront]
research: workflow/research/2026-06-26-customer-reviews.md
estimated_manual_effort: 2h 15m
---

# Customer Reviews — Implementation Plan

## Overview
Add an admin-managed customer-reviews feature: admins create reviews (name,
1–5 star rating, message, optional avatar photo with initials fallback, multiple
gallery images) and assign each to a product. The storefront shows a product's
reviews on its PDP (with an average rating), the relevant reviews on the category
page (category auto-derived from the product), and a "what customers say" carousel
on the home page — each surface hidden when it has no reviews.

## Estimated Manual Effort
**2h 15m** — total human-in-the-loop time only: overviewing/reviewing each phase's
diff and running the manual verification at each pause, plus the final `/validate`.
Implementation is done by Claude Code, so no development hours are counted. Includes
a 10% buffer.

## Current State
- **Runtime DB is Postgres (Supabase).** Authoritative schema: `db/pg/schema.sql`
  (lowercase identifiers, `uuid` PKs via `gen_random_uuid()`); the child-table
  shape to mirror is `productimages` (`db/pg/schema.sql:100`). Legacy MSSQL parity
  migrations live in `db/NN_*.sql` (latest `db/22_design_per_image.sql`).
- **Data layer** `src/lib/storefront.ts`: typed query helpers over the `pg` mssql-shim
  (`getDb().request().input(...).query(...)`), with a batched child-fetch pattern
  `attachColors()` (`src/lib/storefront.ts:52`). `getProductBySlug()` already exposes
  `CategoryId/CategoryName/CategorySlug` (`:360`).
- **Column casing**: `src/lib/columnCase.ts` maps lowercase pg keys → PascalCase
  (`:142`); columns the storefront reads must be registered or they return lowercase.
- **Admin** pages are `src/app/(main)/<name>/page.tsx` (client) + colocated
  `actions.ts` (`"use server"`, direct `getDb`); `catalog/actions.ts:38` is the CRUD
  model. Nav is a static array in `src/components/layout/Sidebar.tsx:34`; the `(main)`
  group is auth-gated in `src/app/(main)/layout.tsx:27`.
- **Uploads**: `POST /api/upload` takes `file` + an allow-listed `folder`
  (`SAFE_FOLDERS` at `src/app/api/upload/route.ts:26`) and returns `{ url, kind }`
  (public Supabase CDN URL). Client pattern: `checkout/page.tsx:14` `uploadSlip()`.
- **Storefront targets** are `force-dynamic` server components:
  PDP `src/app/(shop)/product/[slug]/page.tsx` (related section at `:110`),
  category `src/app/(shop)/category/[slug]/page.tsx:21`, home `src/app/(shop)/page.tsx`
  (already uses the `x.length > 0 && ...` hide-when-empty idiom).
- **Reusable pieces**: `initials(name)` + avatar circle (`AccountMenu.tsx:11`);
  section heading + scroll-snap carousel (`ProductSlider.tsx:38`); zoom lightbox
  (`DesignPicker.tsx`); `Star` icon available from `lucide-react`.
- Nothing review-related exists yet.

## Desired End State
- Admin → **Reviews** page: list + create/edit/delete. Each review has a product,
  name, rating, message, optional avatar, optional multiple gallery images, a
  `published` toggle (default on), and a sort order.
- **PDP**: an average-rating summary (stars + count) near the title, and a reviews
  block under the product; nothing renders if the product has no published reviews.
- **Category page**: a reviews block for products in that category; hidden when empty.
- **Home**: a "What our customers say" carousel of the latest 12 published reviews;
  hidden when empty.
- `npx tsc --noEmit` and `npm run build` are green; manual checks below pass.

## What We're NOT Doing
- **No public review submission** — reviews are admin-entered only (no storefront
  "write a review" form, no auth/ownership, no spam/captcha).
- No helpful/upvote, replies, verified-purchase logic, or per-review reporting.
- No review pagination/infinite scroll (cap home at 12; PDP/category show all for now).
- No email notifications or moderation queue beyond the `published` flag.
- No editing of the legacy MSSQL migrations' behavior — `db/23_*.sql` is parity only;
  the live effect comes from `db/pg/schema.sql` applied to Supabase.

## Touchpoints per surface
> Single repo. The contract is: admin write (`reviews/actions.ts`) ⇄ storefront read
> (`storefront.ts` helpers) ⇄ rendered components, all keyed by `reviews.productid`
> (category derived via `products.categoryid`).
- **DB**: new `reviews` + `reviewimages` tables in `db/pg/schema.sql`; parity file
  `db/23_customer_reviews.sql`; applied to live Supabase via a one-off script.
- **Data layer**: `src/lib/storefront.ts` — `StoreReview` type, `attachReviewImages()`,
  `getReviewsForProduct()`, `getProductRatingSummary()`, `getReviewsByCategory()`,
  `getLatestReviews()`. `src/lib/columnCase.ts` — register new columns.
- **Upload**: add `"reviews"` to `SAFE_FOLDERS` (`src/app/api/upload/route.ts:26`).
- **Admin**: `src/app/(main)/reviews/page.tsx` + `src/app/(main)/reviews/actions.ts`;
  nav item in `src/components/layout/Sidebar.tsx`.
- **Storefront**: `src/components/shop/ReviewCard.tsx`, `ReviewsSection.tsx`,
  `ReviewStars.tsx`; edits to PDP, category, and home pages.
- **Tenancy note**: single-tenant app — no `CompanyKey`/tenant filter applies.

## Phase 1: Database + data layer

### Changes

#### Postgres schema — `db/pg/schema.sql`
Append two tables (match `productimages` conventions: lowercase, `uuid` PK, no FK
constraints — cascade is handled in the delete action; add indexes):
```sql
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  productid uuid NOT NULL,
  customername text NOT NULL,
  customerimage text,
  rating smallint NOT NULL DEFAULT 5,
  message text NOT NULL,
  ispublished boolean NOT NULL DEFAULT true,
  sortorder integer NOT NULL DEFAULT 0,
  createdat timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_productid ON reviews(productid);

CREATE TABLE IF NOT EXISTS reviewimages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewid uuid NOT NULL,
  url text NOT NULL,
  sortorder integer NOT NULL DEFAULT 0,
  createdat timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviewimages_reviewid ON reviewimages(reviewid);
```

#### Parity migration — `db/23_customer_reviews.sql` (new, MSSQL dialect, idempotent)
Mirror the table creation in the numbered-migration style for repo parity (matches
`db/15_new_arrivals.sql` conventions). Not executed against the live DB.

#### Apply to live Supabase — one-off script (scratchpad)
Reuse the `pg` + `.env.local DATABASE_URL` script approach already used this session
to run the two `CREATE TABLE IF NOT EXISTS` + index statements, then verify with
`SELECT to_regclass('public.reviews'), to_regclass('public.reviewimages');`.

#### Column casing — `src/lib/columnCase.ts`
Add any missing lowercase→Pascal entries used by storefront reads:
`customername→CustomerName`, `customerimage→CustomerImage`, `ispublished→IsPublished`,
`reviewid→ReviewId`, plus `rating→Rating` / `message→Message` if absent
(`productid`, `sortorder`, `createdat`, `url`, `id`, `name`, `slug` already exist).

#### Data layer — `src/lib/storefront.ts`
Add the type + read helpers (follow the `attachColors` batched pattern):
```ts
export type StoreReview = {
  Id: string;
  ProductId: string;
  CustomerName: string;
  CustomerImage: string | null;
  Rating: number;
  Message: string;
  CreatedAt: string;
  ProductName?: string | null;  // populated by getLatestReviews for home links
  ProductSlug?: string | null;
  Images: string[];
};

// Batched second query: review id -> image urls (no N+1), mirrors attachColors.
async function attachReviewImages(pool, rows: StoreReview[]): Promise<StoreReview[]>;

export async function getReviewsForProduct(productId: string): Promise<StoreReview[]>;
// avg + count of published reviews for the PDP summary
export async function getProductRatingSummary(productId: string): Promise<{ avg: number; count: number }>;
// join reviews -> products on productid where products.categoryid = (category by slug).id
export async function getReviewsByCategory(categorySlug: string): Promise<StoreReview[]>;
// latest N published, with product name/slug for home-card linking
export async function getLatestReviews(limit?: number): Promise<StoreReview[]>;
```
All review reads filter `ispublished = true` and order by `sortorder, createdat DESC`.

### Success Criteria
#### Automated (the deterministic gate — must be green)
- [x] Type-checks: `npx tsc --noEmit`  (clean for app code; stale `.next/dev` artifact removed)
- [x] Production build: `npm run build`
#### Manual (human verification)
- [x] Script output shows both tables exist (`to_regclass` non-null) — verified: `reviews` + `reviewimages` live in Supabase.
- [ ] A quick `SELECT` of a manually-inserted test row round-trips with PascalCase
      keys through a temporary call (or confirmed in Phase 2 once admin exists).

**Pause here** for human confirmation before the next phase.

---

## Phase 2: Admin reviews page (CRUD)

### Changes

#### Upload allow-list — `src/app/api/upload/route.ts`
Add `"reviews"` to `SAFE_FOLDERS` so avatar + gallery uploads aren't downgraded to `misc`.

#### Server actions — `src/app/(main)/reviews/actions.ts` (new, `"use server"`)
- `getAdminReviews()` — list with product name, rating, published, image count
  (join `products`, count `reviewimages`).
- `getReviewForEdit(id)` — review row + its image urls.
- `getReviewProductOptions()` — reuse `getCatalogProducts()` (Id, Name, CategoryName)
  for the product picker.
- `saveReview(payload)` — upsert by `id` (insert when none); then replace
  `reviewimages` (delete existing, insert the provided ordered urls).
- `deleteReview(id)` — delete `reviewimages` then the `reviews` row (manual cascade).

#### Admin page — `src/app/(main)/reviews/page.tsx` (new, client)
Mirror `catalog/` admin conventions and dark admin styling:
- **List**: table of reviews (avatar/initials, name, product, star rating, published
  badge, image count) with Edit / Delete.
- **Editor** (panel or modal): product `<select>`; name input; star rating picker
  (1–5, `Star` icons); message textarea; **avatar** upload (single → `folder:"reviews"`,
  stores `customerimage`); **gallery** multi-upload (`<input multiple>` → `Promise.all`
  over files → ordered `reviewimages`); `published` checkbox (default checked);
  `sortorder` number. Uses the existing `uploadSlip`-style helper against `/api/upload`.

#### Nav — `src/components/layout/Sidebar.tsx`
Add `{ href: "/reviews", label: "Reviews", icon: Star }` (import `Star` from lucide)
near the storefront-management items (after Store Settings).

### Success Criteria
#### Automated (the deterministic gate — must be green)
- [x] Type-checks: `npx tsc --noEmit`
- [x] Production build: `npm run build`
#### Manual (human verification)
- [ ] Admin → Reviews appears in the sidebar and loads.
- [ ] Create a review with a product, rating, message, an avatar, and ≥2 gallery
      images; it saves and appears in the list with the right image count.
- [ ] Edit it (change rating/message, add/remove an image); changes persist.
- [ ] Toggle `published` off; delete another review — both behave correctly.

**Pause here** for human manual-test confirmation before the next phase.

---

## Phase 3: Storefront display

### Changes

#### Shared components — `src/components/shop/`
- `ReviewStars.tsx` — renders N filled / (5−N) empty `Star` icons (supports a
  fractional/average display for the PDP summary).
- `ReviewCard.tsx` — avatar (`customerimage` or `initials(name)` circle reusing the
  `AccountMenu` helper), name, `ReviewStars`, message, and a thumbnail strip of
  `Images` with a click-to-zoom **lightbox** (reuse the `DesignPicker` lightbox
  pattern). Optional product name/link line (used on home).
- `ReviewsSection.tsx` — heading (uppercase + `border-primary` underline like
  `ProductSlider.tsx:38`) + layout. **Returns `null` when `reviews.length === 0`.**
  Supports a `carousel` variant (scroll-snap track) for home and a grid for PDP/category.

#### PDP — `src/app/(shop)/product/[slug]/page.tsx`
- Fetch `getReviewsForProduct(product.Id)` and `getProductRatingSummary(product.Id)`
  (add to the existing `Promise.all`).
- Show the average (`ReviewStars` + "(N reviews)") near the header/price (only when
  `count > 0`).
- Render `<ReviewsSection reviews=... title="Customer Reviews" />` below the product
  (after `ProductView`, before/after "You may also like").

#### Category — `src/app/(shop)/category/[slug]/page.tsx`
- Fetch `getReviewsByCategory(slug)` and render a `ReviewsSection`
  (title e.g. "Reviews in {cat.Name}") below the product grid; hidden when empty.

#### Home — `src/app/(shop)/page.tsx`
- Fetch `getLatestReviews(12)` (add to the page's `Promise.all`) and render
  `<ReviewsSection reviews=... title="What our customers say" carousel />` near the
  bottom (after the product sliders), with product links; hidden when empty.

### Success Criteria
#### Automated (the deterministic gate — must be green)
- [x] Type-checks: `npx tsc --noEmit`
- [x] Production build: `npm run build`
#### Manual (human verification)
- [ ] PDP of a reviewed product shows the average rating + the reviews block;
      avatars fall back to initials when no photo; image thumbnails open the lightbox.
- [ ] The same product's category page shows the review under "Reviews in {category}".
- [ ] Home shows the "What our customers say" carousel with the latest reviews,
      each linking to its product.
- [ ] A product/category/home with **no** published reviews renders **no** review
      section (no empty headings).

**Pause here** for final human confirmation, then `/validate`.

## Testing Strategy
- No automated test suite in this repo. Each phase is gated by `npx tsc --noEmit`
  and `npm run build`, plus the manual steps above.
- Seed data: at least one published review with an avatar + ≥2 gallery images on a
  product that belongs to a visible category, so PDP, category, and home can all be
  verified in one pass. Also create one review with **no** avatar (initials path) and
  leave one product with **no** reviews (hide-when-empty path).

## References
- Research: `workflow/research/2026-06-26-customer-reviews.md`
- Child-table + batched fetch: `db/pg/schema.sql:100`, `src/lib/storefront.ts:52`
- Admin CRUD model: `src/app/(main)/catalog/actions.ts:38`; nav `src/components/layout/Sidebar.tsx:34`; auth gate `src/app/(main)/layout.tsx:27`
- Upload: `src/app/api/upload/route.ts:26`; client helper `src/app/(shop)/checkout/page.tsx:14`
- Render hooks: `src/app/(shop)/product/[slug]/page.tsx:110`, `src/app/(shop)/category/[slug]/page.tsx:21`, `src/app/(shop)/page.tsx`
- Reuse: `src/components/shop/AccountMenu.tsx:11` (initials), `src/components/shop/ProductSlider.tsx:38` (heading/carousel), `src/components/shop/DesignPicker.tsx` (lightbox)
- Industry standard considered: admin-curated reviews with star rating + average +
  publish flag + photo reviews is the mainstream e-commerce pattern (e.g. Shopify
  product-review apps); this plan follows it while matching repo conventions
  (no public submission, since the requirement is admin-entered).
```
