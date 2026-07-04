---
date: 2026-07-04
slug: feedback-screenshots
status: shipped   # user approved plan→implement in one run ("go"); defaults accepted (publish-on-upload, below reviews, no header nav)
surfaces: [db, data-layer, admin, storefront]
research: workflow/research/2026-07-04-feedback-screenshots.md
estimated_manual_effort: 1h 35m
---

# Customer Feedback Wall (screenshots) — Implementation Plan

## Overview
Add an admin-managed "Feedback Wall": each item is one customer-feedback
screenshot (WhatsApp chat etc.) with an optional customer name. Screenshots
are the content — no product link, rating, or message required. Display: a
marquee band on the home page and a dedicated `/feedback` page, both with
tap-to-zoom via the existing `GalleryLightbox`.

## Estimated Manual Effort
**1h 35m** — total human-in-the-loop time only: reviewing each phase's diff,
running the manual verification steps, plus the final `/validate`.
Implementation is done by Claude Code, so no development hours are counted.
Includes a 10% buffer.

## Current State
- No screenshot-first feature exists. Reviews require a product + message
  (`db/pg/schema.sql:350-361`, `reviews/actions.ts:92-95`); the gallery is
  semantically the custom-orders showcase
  (see `workflow/research/2026-07-04-feedback-screenshots.md`).
- Reusable pieces already shipped: `GalleryLightbox`
  (`src/components/shop/GalleryLightbox.tsx` — images/startIndex/onClose),
  the reviews marquee idiom (`ReviewsSection.tsx:36-49`, `animate-marquee` +
  `marquee-pause` utilities), the black-panel section header idiom, the
  admin editor+list single-file pattern (`reviews/page.tsx`), `/api/upload`
  folder allow-list (`src/app/api/upload/route.ts:26` — no `feedback` entry
  yet), and the `?show=` capped load-more pattern
  (`src/app/(shop)/gallery/page.tsx:25-27`).
- `columnCase.ts` already maps `customername` and `imageurl` (`:49`, `:139`)
  — **no new entries needed** (verify at implement; the generator must NOT
  be run, it is stale — hand-edit only if something is missing).
- Footer has a "Shop" link list to extend (`StoreFooter.tsx:47-56`).
- **Route-collision lesson from gallery**: `(main)` and `(shop)` share the
  URL space, so the admin route must NOT be `/feedback` — use
  `/store-feedback` (matches `/store-gallery`, `/store-settings`).

## Desired End State
- Admin → **Feedback** (`/store-feedback`): bulk-upload screenshots (one
  item per file, published immediately), edit an item's optional customer
  name / published / sort order, delete items.
- Home page: a "Customer Feedback" black marquee band of screenshots
  (pause on hover, click to zoom) below the reviews band, with a
  "View all feedback" `rounded-lg` CTA → `/feedback`; hidden when empty.
- `/feedback`: responsive multi-column wall of screenshots at natural
  aspect ratio, lazy-loaded, click-to-zoom lightbox with next/prev,
  capped "Load more", SEO metadata + sitemap entry, footer link.
- `npx tsc --noEmit` and `npm run build` green; deployed to
  essencefits.com via push to `main`.

## What We're NOT Doing
- No changes to the Reviews or Gallery features (schema, admin, display).
- No public submission — admin-entered only.
- No captions, ratings, or product links on feedback items (screenshot +
  optional name only, per user decision).
- No header-nav link (nav already has Shop/Customize/Deals/Gallery; the
  page is reachable from the home CTA, footer, and sitemap).
- No child-image table — one screenshot per item (bulk upload creates
  multiple items).
- No search on `/feedback` (names are optional; wall is browse-only).

## Touchpoints per surface
> Single repo. Contract: admin write (`store-feedback/actions.ts`) ⇄
> storefront read (`storefront.ts` helpers) ⇄ home band + `/feedback` page,
> keyed by `feedbackitems.id`.
- **DB**: new `feedbackitems` table in `db/pg/schema.sql`; parity file
  `db/27_feedback.sql`; applied live via `node db/pg/apply.mjs`.
- **Data layer**: `src/lib/storefront.ts` — `FeedbackItem` type,
  `getLatestFeedback()`, `getFeedbackItems()` (limit + total).
  `columnCase.ts`: expected no-op (entries exist).
- **Upload**: add `"feedback"` to `SAFE_FOLDERS` (`upload/route.ts:26`).
- **Admin**: `src/app/(main)/store-feedback/page.tsx` + `actions.ts`;
  Sidebar item after Gallery.
- **Storefront**: `src/components/shop/FeedbackSection.tsx` (home band) and
  `FeedbackWall.tsx` (client grid+lightbox for the page); new
  `src/app/(shop)/feedback/page.tsx`; home page wiring; footer link;
  `src/app/sitemap.ts` entry. Lightbox: reuse `GalleryLightbox` as-is.
- **Tenancy note**: single-tenant app — no tenant filter applies.

## Phase 1: Database + data layer

### Changes

#### Postgres schema — `db/pg/schema.sql`
Append after the gallery tables (no child table — the screenshot IS the item):
```sql
-- Admin-managed feedback wall: each item is one customer-feedback screenshot
-- (WhatsApp chat etc.) with an optional customer name. Screenshot-first:
-- no product link, rating, or message.
CREATE TABLE IF NOT EXISTS feedbackitems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customername text,
  imageurl text NOT NULL,
  ispublished boolean NOT NULL DEFAULT true,
  sortorder integer NOT NULL DEFAULT 0,
  createdat timestamp NOT NULL DEFAULT now()
);
```

#### Parity migration — `db/27_feedback.sql` (new, MSSQL dialect, idempotent)
`FeedbackItems` mirrored in numbered-migration style (matches
`db/26_gallery.sql`); parity doc only, not executed.

#### Apply to live Supabase
`node db/pg/apply.mjs <scratchpad file with the new CREATE>` then verify
`SELECT to_regclass('public.feedbackitems');` is non-null.

#### Data layer — `src/lib/storefront.ts`
```ts
export type FeedbackItem = {
  Id: string;
  CustomerName: string | null;
  ImageUrl: string;
  CreatedAt: string;
};
export async function getLatestFeedback(limit = 10): Promise<FeedbackItem[]>;
// ispublished = true, ORDER BY sortorder, createdat DESC, LIMIT @n
export async function getFeedbackItems(opts: { limit: number }): Promise<{ items: FeedbackItem[]; total: number }>;
// same ordering; total via COUNT(*) for the Load-more button
```
Verify `customername`/`imageurl` round-trip through `columnCase.ts`
(entries exist at `:49`/`:139`; do NOT run `gen-colmap.mjs`).

#### Upload allow-list — `src/app/api/upload/route.ts`
Add `"feedback"` to `SAFE_FOLDERS`.

### Success Criteria
#### Automated (the deterministic gate — must be green)
- [x] Type-checks: `npx tsc --noEmit`
- [x] Production build: `npm run build`
#### Manual (human verification)
- [x] `to_regclass('public.feedbackitems')` non-null on live Supabase (verified 2026-07-04).

---

## Phase 2: Admin Feedback page

### Changes

#### Server actions — `src/app/(main)/store-feedback/actions.ts` (new, `"use server"`)
- `getAdminFeedbackItems()` — all items, `ORDER BY sortorder, createdat DESC`.
- `addFeedbackItems(urls: string[])` — bulk insert: one published item per
  URL (sortorder 0). Validation: at least one URL.
- `saveFeedbackItem({ id, customerName, isPublished, sortOrder })` — update
  name/flags of an existing item (screenshot itself is immutable; replace =
  delete + re-add).
- `deleteFeedbackItem(id)`.

#### Admin page — `src/app/(main)/store-feedback/page.tsx` (new, client)
Mirrors the reviews/gallery single-file pattern (same `input`/`card` class
strings, toasts, `confirm()` delete):
- **Quick add card**: one multi-file input ("Add screenshots"); uploads all
  files to folder `feedback` in parallel (`Promise.all`, like
  `reviews/page.tsx:117-129`), then `addFeedbackItems(urls)` and refresh.
- **List card**: thumbnail rows (screenshot, name or "—", Hidden badge,
  date); Edit loads name/published/sortorder into a small inline editor at
  the top; Delete with confirm.

#### Nav — `src/components/layout/Sidebar.tsx`
`{ href: "/store-feedback", label: "Feedback", icon: MessageSquareQuote }`
after the Gallery entry (not admin-only, same as Reviews/Gallery).

### Success Criteria
#### Automated (the deterministic gate — must be green)
- [x] Type-checks: `npx tsc --noEmit`
- [x] Production build: `npm run build`
#### Manual (human verification)
- [ ] Bulk-upload 3+ screenshots at once → 3 items appear published.
- [ ] Edit one (add name, unpublish), delete one; list reflects it.

**Pause here** for human manual-test confirmation before the next phase
(unless running all phases in one approved pass).

---

## Phase 3: Storefront — home band + /feedback page

### Changes

#### `src/components/shop/FeedbackWall.tsx` (new, client)
Props `items: FeedbackItem[]`, `variant: "marquee" | "wall"`. Owns the
lightbox state and reuses `GalleryLightbox` over all screenshot URLs
(clicked item = `startIndex`).
- `marquee`: fixed-height cards (`h-64 sm:h-72`, width auto, natural aspect,
  `rounded-lg`, `loading="lazy"`) in the duplicated-track marquee idiom from
  `ReviewsSection.tsx:36-49` (`animate-marquee`, `marquee-pause`); optional
  name overlaid in a bottom gradient strip when present.
- `wall`: CSS multi-column layout (`columns-2 sm:columns-3 lg:columns-4`,
  `break-inside-avoid`) with images at natural aspect (`w-full h-auto`) —
  screenshots are tall/variable, so columns beat a cropping grid; name
  under each image when present.

#### `src/components/shop/FeedbackSection.tsx` (new)
Home band: black rounded panel, eyebrow "Real conversations" + uppercase
title with primary underline (same header idiom as `ReviewsSection`/
`GallerySection`), `FeedbackWall variant="marquee"`, centered `rounded-lg`
CTA "View all feedback" → `/feedback`. Returns `null` when empty.

#### Feedback page — `src/app/(shop)/feedback/page.tsx` (new, server)
- `metadata`: title "Customer Feedback", description, canonical `/feedback`;
  `export const dynamic = "force-dynamic"`.
- Reads `searchParams.show` (default 24, **capped at 120** — same guard as
  `gallery/page.tsx:25-27`); fetches `getFeedbackItems({ limit: show })`.
- Renders heading, `FeedbackWall variant="wall"`, empty state, and a
  "Load more" link `?show=show+24` (`scroll={false}`, only while
  `items.length < total`).

#### Home page — `src/app/(shop)/page.tsx`
Add `getLatestFeedback(10)` to the `Promise.all`; render
`<FeedbackSection items={...} title="Straight from our customers" />` in a
`max-w-[1920px]` wrapper directly below the reviews band, guarded by
`items.length > 0`.

#### Footer — `src/components/shop/StoreFooter.tsx`
Add `<li><Link href="/feedback">Customer feedback</Link></li>` to the
"Shop" list (`StoreFooter.tsx:50-56`).

#### SEO — `src/app/sitemap.ts`
Add `{ url: `${BASE}/feedback`, priority: 0.5, changeFrequency: "weekly" }`.

### Success Criteria
#### Automated (the deterministic gate — must be green)
- [x] Type-checks: `npx tsc --noEmit`
- [x] Production build: `npm run build`
#### Manual (human verification)
- [ ] Home shows the feedback marquee (pauses on hover, click zooms);
      hidden when no published items; CTA opens `/feedback`.
- [ ] `/feedback` wall is responsive; lightbox next/prev + Escape + mobile
      tap targets; Load more works; unpublished items never appear;
      footer link present.

---

## Phase 4: Ship
- Re-run the full gate (`npx tsc --noEmit`, `npm run build`).
- Commit and push to `main` → Vercel auto-deploy; verify `/feedback` and
  the home band live on essencefits.com.

### Success Criteria
- [ ] Gate green; pushed; live URLs return 200.

## Testing Strategy
- No automated test suite exists; each phase is gated by
  `npx tsc --noEmit` + `npm run build` plus the manual steps above.
- Seed: bulk-upload 3 real screenshots, then set a name on one, unpublish
  one — verifies bulk add, name display, and the published filter in one
  pass.

## References
- Research: `workflow/research/2026-07-04-feedback-screenshots.md`
- Lightbox reuse: `src/components/shop/GalleryLightbox.tsx`
- Marquee idiom: `src/components/shop/ReviewsSection.tsx:36-49`
- Capped `?show=` pattern: `src/app/(shop)/gallery/page.tsx:25-27`
- Admin single-file pattern: `src/app/(main)/reviews/page.tsx`,
  `src/app/(main)/store-gallery/page.tsx`
- Industry standard considered: testimonial "wall of love" sections
  (screenshot-first cards, masonry/column flow, click-to-zoom, admin-curated
  — the pattern popularized by tools like Testimonial.to/Senja). This plan
  follows that shape using the repo's existing marquee/lightbox idioms; no
  external dependency needed.
