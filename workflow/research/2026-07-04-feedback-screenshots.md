---
date: 2026-07-04
topic: "Where can customer feedback screenshots (e.g. WhatsApp chat screenshots) be added to the storefront today? Can Reviews or the Custom Orders Gallery host them, or is something new needed?"
repo_commit: "0356323"
status: complete
tags: [research, reviews, gallery, uploads, storefront]
---

# Research: Customer feedback screenshots — where can they live today?

> Note: the `/research` skill is written for the 3-repo Maraebiz workspace.
> This is the single-repo **essencefit-dashboard** Next.js 16 app, so sections
> are adapted to this repo's layers (DB → data layer → admin → storefront),
> same convention as prior research docs.

## Research Question

The owner has screenshots of customer feedback (WhatsApp chats etc.) and
wants them on the website. Is there an existing option/place for them —
specifically in the Customer Reviews feature or the new Custom Orders
Gallery — or does something new have to be created?

## Summary

**Yes, an existing place can host them today: the Customer Reviews feature.**
Every review supports multiple "Review photos" uploaded from the admin page;
they render as click-to-zoom thumbnails on the review cards shown on the home
page, every product page, and every category page. A WhatsApp screenshot can
be uploaded as a review photo right now with zero code changes.

**Two constraints** in the current Reviews shape matter for screenshots-only
feedback:
1. A review **must be assigned to a product** (`reviews.productid uuid NOT
   NULL`; the save action rejects an empty product).
2. A review **must have a typed message and a rating** (message `NOT NULL` +
   action validation; rating defaults to 5). The card layout is text-first:
   the message is the body, photos are 64×64 thumbnails underneath.

So feedback that maps naturally to "customer X said Y about product Z" fits
the existing feature perfectly (type/paste the text, attach the screenshot).
A **screenshot-first wall** (big images, no product/rating/text required)
does not exist today — the Gallery is image-first but is semantically the
custom-orders showcase (artwork + delivered product) with its own public
`/gallery` page, so parking feedback screenshots there would mix content
types on a page titled "Custom Orders Gallery".

## Detailed Findings

### Database (PostgreSQL / Supabase — `db/pg/schema.sql`)
- `reviews` (`db/pg/schema.sql:350-361`): `productid uuid NOT NULL`,
  `customername NOT NULL`, `customerimage` (avatar, nullable),
  `rating smallint DEFAULT 5`, `message text NOT NULL`, `ispublished`,
  `sortorder`, `createdat`.
- `reviewimages` (`db/pg/schema.sql:363-369`): child table — `reviewid`,
  `url`, `sortorder`. Unlimited photos per review. **This is where feedback
  screenshots would be stored if attached to reviews.**
- `galleryitems` / `galleryimages` (`db/pg/schema.sql:371-393`): custom-orders
  gallery. `artworkurl` is nullable and `caption` optional, but the save
  action requires ≥1 final-product image and the feature's copy everywhere
  ("Custom Orders Gallery", "their artwork, our print") frames it as order
  showcases, not feedback.

### Upload pipeline
- `POST /api/upload` (`src/app/api/upload/route.ts`): images (JPG/PNG/WEBP/
  GIF) up to 5MB; `SAFE_FOLDERS` already includes `reviews` and `gallery`
  (`route.ts:26`). Screenshots are ordinary images — they pass validation
  as-is.

### Admin (model: Reviews page)
- `src/app/(main)/reviews/page.tsx` — "Review photos (optional, multiple)"
  multi-upload strip (`page.tsx:266-288`) uploads to folder `reviews` via
  `Promise.all` and saves URLs into `reviewimages` on save
  (`actions.ts:130-139`). **An admin can attach WhatsApp screenshots here
  today.**
- Required fields enforced in `saveReview` (`actions.ts:92-95`): productId,
  customerName, message. Rating is clamped 1–5, defaults 5.
- Gallery admin (`src/app/(main)/store-gallery/page.tsx` + `actions.ts:76-78`)
  requires customer name + ≥1 image; artwork and caption optional.

### Storefront — where review photos display
- `ReviewCard` (`src/components/shop/ReviewCard.tsx:85-94`): photos render as
  a row of 64×64 (`w-16 h-16`) rounded thumbnails under the message; clicking
  opens a full-screen zoom overlay with Escape-to-close
  (`ReviewCard.tsx:102-110`). Text (`Message`) is the visual anchor;
  screenshots would be small until tapped.
- Render points:
  - Home page: `ReviewsSection` carousel (`src/app/(shop)/page.tsx:66-68`).
  - Product page: per-product reviews carousel
    (`src/app/(shop)/product/[slug]/page.tsx:51,182`, data:
    `getReviewsForProduct`, `src/lib/storefront.ts:518`).
  - Category page: category-wide reviews
    (`src/app/(shop)/category/[slug]/page.tsx:33,67`, data:
    `getReviewsByCategory`, `src/lib/storefront.ts:545`).
- Gallery render points (image-first, for comparison): `/gallery` grid +
  lightbox and the home "Custom orders, made real" panel
  (`src/components/shop/GalleryCard.tsx`, `GallerySection.tsx`,
  `src/app/(shop)/gallery/page.tsx`).

### What does NOT exist today
- No screenshot-first "feedback wall" — no section anywhere that displays a
  standalone image as the review itself (large, no product link, no typed
  message).
- No review shape without a product: `productid` is `NOT NULL` at the DB
  level and validated in the action.
- No public review submission — reviews and gallery are both admin-entered
  only (consistent with the site's admin-curated content model).

## Code References
- `db/pg/schema.sql:350-369` — reviews + reviewimages (productid NOT NULL)
- `src/app/(main)/reviews/actions.ts:92-95` — required product/name/message
- `src/app/(main)/reviews/actions.ts:130-139` — screenshot URLs → reviewimages
- `src/app/(main)/reviews/page.tsx:266-288` — admin multi-photo upload strip
- `src/components/shop/ReviewCard.tsx:85-110` — thumbnail row + zoom overlay
- `src/app/(shop)/page.tsx:66-68` — home reviews carousel
- `src/app/(shop)/product/[slug]/page.tsx:182` — PDP reviews
- `src/app/(shop)/category/[slug]/page.tsx:67` — category reviews
- `src/app/api/upload/route.ts:26` — `reviews`/`gallery` upload folders
- `src/components/shop/GalleryCard.tsx` — image-first card pattern (gallery)

## Architecture / Conventions Observed
- Both showcase features (reviews, gallery) follow the same admin-curated
  model: parent table + ordered child-image table, `IsPublished` +
  `SortOrder`, single-file client admin page + `"use server"` actions,
  storefront reads in `src/lib/storefront.ts`, display components in
  `src/components/shop/`.
- Screenshots are just images to the pipeline — Supabase Storage public CDN
  URLs, plain `<img>` tags.

## Related Prior Work (from workflow/)
- `workflow/research/2026-06-26-customer-reviews.md` +
  `workflow/plans/2026-06-26-customer-reviews.md` — the reviews feature
  (shipped).
- `workflow/archive/{research,plans,validation}/2026-07-03-gallery-management.md`
  — the custom-orders gallery (shipped 2026-07-03, commit b59e5ce).

## Open Questions (for the Plan phase, if the current fit isn't enough)
- Are the screenshots tied to identifiable products? If yes, the existing
  Reviews feature fits as-is (paste the text, attach the screenshot).
- If a screenshot-first display is wanted, the lightest paths would be
  (a) extending Reviews (e.g. optional product / screenshot-style card) or
  (b) a small dedicated "feedback wall" section reusing the gallery's
  image-first card+lightbox pattern — choosing between these is a plan
  decision, not research.
