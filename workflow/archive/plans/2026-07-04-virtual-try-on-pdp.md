---
date: 2026-07-04
slug: virtual-try-on-pdp
status: removed   # implemented in 1e5c7da, then removed same day — user cannot enable Gemini billing yet; restore with: git revert <removal-commit> or cherry-pick 1e5c7da
surfaces: [db, api, storefront]
research: workflow/research/2026-07-04-virtual-try-on-pdp.md
estimated_manual_effort: 1h 20m
---

# Virtual Try-On on the PDP — Implementation Plan

## Overview
Add a "Try It On" button to the product page (modeled on merakiclothings.com's
GenLook widget): a modal where the customer uploads a photo, an AI model
renders them wearing the selected product, and they can download the result.
Generation via **Google Gemini 2.5 Flash Image** (~$0.04/image; free-tier API
key available from AI Studio to start).

## Estimated Manual Effort
**1h 20m** — total human-in-the-loop time only: reviewing each phase's diff,
running the manual verification steps (needs a `GEMINI_API_KEY` and a few real
photos), plus the final `/validate`. Implementation is done by Claude Code, so
no development hours are counted. Includes a 10% buffer.

## Current State
- No AI integration exists anywhere (`package.json` — no AI SDKs, no `sharp`).
- The garment image for the selected color is already resolved client-side:
  `currentImage` at `src/components/shop/ProductView.tsx:59`.
- Both PDP layouts render `header → <AddToCart> → footer` in one block
  (`ProductView.tsx:86-90` stacked, `:115-121` grid) — the button slots after
  `<AddToCart>` in both.
- Upload conventions: `/api/upload` route (`src/app/api/upload/route.ts`)
  validates type/size and proxies to Supabase — but this feature does NOT
  persist the customer photo at all (see below), so it only borrows the
  route's validation/style, not the route itself.
- Overlay precedent: `ProductGallery.tsx` renders a full-screen inline
  lightbox with body-scroll lock — the try-on modal follows that inline
  pattern (no layout-level provider needed; the button exists only where
  `ProductView` renders).
- DB: Postgres (Supabase) via `src/lib/db.ts`/`sqlShim.ts`; schema in
  `db/pg/schema.sql`, applied live via `node db/pg/apply.mjs`; per MEMORY.md
  never run `gen-colmap.mjs`.

## Desired End State
- Every standard product's PDP shows a "Try It On ✨" button under the buy
  buttons (desktop grid + stacked/quick-view layouts).
- Clicking opens a modal: product image preview → photo upload (with "take a
  photo in a mirror" tip + "AI can make mistakes" disclaimer) → ~5-20s
  generation → result image with Download / Try again.
- Customer photos are sent to the API, forwarded to Gemini, and **never
  stored** (no Supabase upload, no DB row) — stated in the modal.
- Abuse control: per-IP daily cap (8) and global daily cap (150) via a tiny
  `tryonusage` table; friendly "limit reached" message.
- Button hidden entirely when `GEMINI_API_KEY` is not configured (safe deploy
  before the key exists).
- `npx tsc --noEmit` + `npm run build` green; pushed to `main`.

## What We're NOT Doing
- No third-party widget (GenLook is Shopify-only) and no FASHN account —
  Gemini chosen for the free-tier key and lowest per-image cost; FASHN
  (~$0.075/img, purpose-built) stays the documented fallback if garment
  fidelity disappoints.
- No persistence of customer photos or generated images (privacy default;
  also removes any retention/cleanup work). Download is client-side only.
- No Terms/Privacy pages (none exist on the site); the modal carries plain
  disclaimer text instead of links.
- No login gating, no async job queue (blocking spinner like the reference
  site), no try-on analytics/email capture.
- No try-on on `SelectByImage`/DTF products (`DesignPicker` branch) — garment
  images there are printed-design catalogs, not wearable-shot photos.
- No admin per-product enable/disable toggle (v1 is on for all standard
  products when the key is configured).

## Touchpoints per surface
> Single repo. Contract: `POST /api/tryon` (multipart `photo` +
> `productImage` URL + `productName`) → `{ image: <data URL> }` |
> `{ error }` ⇄ `TryOn.tsx` client component.
- **DB**: new `tryonusage` table (`id`, `ip`, `createdat`) in
  `db/pg/schema.sql`; parity file `db/28_tryon.sql`; applied via
  `node db/pg/apply.mjs`. Queries use `COUNT(*) AS n` + parameterized
  inserts, so `columnCase.ts` is untouched (do NOT run the generator).
- **API**: new `src/app/api/tryon/route.ts` (`runtime = "nodejs"`,
  `maxDuration = 60`) — validates, rate-checks, calls Gemini REST, returns a
  base64 data URL. New env: `GEMINI_API_KEY` (AI Studio key; also needed in
  Vercel).
- **Storefront**: new `src/components/shop/TryOn.tsx` (button + inline
  modal); wired into `ProductView.tsx` after `<AddToCart>` in both layouts;
  `page.tsx` passes `tryOnEnabled={Boolean(process.env.GEMINI_API_KEY)}`.
- **Tenancy note**: single-tenant app — no tenant filter applies.

## Phase 1: DB cap table + `/api/tryon` route

### Changes

#### Postgres schema — `db/pg/schema.sql`
```sql
-- Virtual try-on usage log: one row per generation attempt, used only to
-- enforce per-IP and global daily caps. No customer photo is ever stored.
CREATE TABLE IF NOT EXISTS tryonusage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  createdat timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tryonusage_created ON tryonusage (createdat);
```
Parity doc `db/28_tryon.sql` (MSSQL dialect, idempotent, not executed).
Apply live via `node db/pg/apply.mjs`; verify
`SELECT to_regclass('public.tryonusage');`.

#### Try-on route — `src/app/api/tryon/route.ts` (new)
- Accepts multipart: `photo` (File, jpeg/png/webp, ≤5MB — client downscales
  first), `productImage` (URL string — must start with the Supabase public
  prefix or be same-origin, to stop SSRF), `productName` (string, for the
  prompt).
- Guards in order: key configured → types/sizes valid → per-IP daily count
  (`x-forwarded-for` first hop) < 8 → global daily count < 150. Cap hit →
  429 `{ error: "Daily try-on limit reached. Please try again tomorrow." }`.
- Logs one `tryonusage` row per accepted attempt (before calling Gemini).
- Fetches product-image bytes server-side; base64s both images; calls
  `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`
  (header `x-goog-api-key`) with a fixed VTON prompt ("Dress the person in
  the first photo in the garment from the second photo; keep the person's
  face, pose, body and background unchanged; photorealistic.") and both
  `inline_data` parts.
- Extracts the first `inlineData` image part from the response; returns
  `{ image: "data:<mime>;base64,<data>" }`. No storage writes. Distinct
  error messages for: not configured / bad input / limit / model refusal /
  upstream failure.

### Success Criteria
#### Automated (the deterministic gate — must be green)
- [ ] Type-checks: `npx tsc --noEmit`
- [ ] Production build: `npm run build`
#### Manual (human verification)
- [ ] `to_regclass('public.tryonusage')` non-null on live Supabase.
- [ ] With `GEMINI_API_KEY` set in `.env.local`: a curl/multipart POST with a
      test photo + a product image URL returns a data-URL image.

**Pause here** (unless running all phases in one approved pass).

---

## Phase 2: TryOn UI + PDP wiring

### Changes

#### `src/components/shop/TryOn.tsx` (new, client)
Props: `productImage: string`, `productName: string`. Renders:
- **Button**: full-width `rounded-lg` outlined button under the buy buttons —
  sparkle icon + "Try It On" + "See how it looks on you" subtext (per
  MEMORY.md: `rounded-lg`, never pill).
- **Modal** (inline, follows the `ProductGallery` lightbox idiom: fixed
  overlay, `bg-black/70` backdrop, body-scroll lock, Escape/backdrop close;
  centered card `max-w-lg`, `rounded-lg`):
  - *Idle*: "Ready to try it on?" header; product thumbnail ("Product to try
    on"); dashed upload label ("Choose Your Photo", hidden
    `<input type="file" accept="image/*">`), tip "Best result: a full-body
    photo — try one in a mirror"; footer small-print: "Your photo is used
    once to generate the preview and is never stored. AI can make mistakes —
    the result is a visualization, not an exact fit."
  - On file pick: canvas-downscale to max 1280px JPEG (quality 0.85) —
    keeps uploads small/fast and under the route cap; show photo preview +
    "Generate my look" button + "Change photo".
  - *Generating*: spinner + rotating status lines ("Fitting the garment…",
    ~5-20s expectation set).
  - *Result*: generated image large; buttons: "Download" (anchor with
    `download` attr on the data URL), "Try another photo" (back to idle,
    keeps modal open); errors surface inline with retry (429 message shown
    verbatim).
- `fetch("/api/tryon", { method: "POST", body: FormData })` — same
  client-upload idiom as `CustomizeForm.tsx:114-133`.

#### PDP wiring — `src/components/shop/ProductView.tsx`
- New optional prop `tryOnEnabled?: boolean`.
- Render `{tryOnEnabled && currentImage && <TryOn productImage={currentImage} productName={product.Name} />}`
  immediately after `<AddToCart …/>` in **both** layouts (stacked `:88`,
  grid `:118`) — so it also appears in the Quick View drawer.
- `page.tsx` (`src/app/(shop)/product/[slug]/page.tsx`): pass
  `tryOnEnabled={Boolean(process.env.GEMINI_API_KEY)}` on the `ProductView`
  branch only (not `DesignPicker`). Quick View (`quickview-actions.ts` →
  `QuickView.tsx`) gets the same flag if its data path renders `ProductView`
  with buy actions — verify at implement; if the flag isn't cleanly
  threadable there, scope v1 to the full PDP only.

### Success Criteria
#### Automated (the deterministic gate — must be green)
- [ ] Type-checks: `npx tsc --noEmit`
- [ ] Production build: `npm run build`
#### Manual (human verification)
- [ ] PDP shows the button; modal opens; photo picks/downscales; generation
      returns a plausible try-on for 2-3 different products/photos.
- [ ] Color switch changes the garment image sent (check modal thumbnail).
- [ ] Mobile: file input opens camera roll; modal scrolls; download works.
- [ ] Unset `GEMINI_API_KEY` locally → button absent, page fine.
- [ ] 9th generation from one IP in a day → friendly limit message.

**Pause here** (unless running all phases in one approved pass).

---

## Phase 3: Ship
- Re-run the gate (`npx tsc --noEmit`, `npm run build`).
- Add `GEMINI_API_KEY` to Vercel env (user action; button stays hidden until
  then — safe to deploy first).
- Commit and push to `main` → Vercel auto-deploy; verify on essencefits.com.

### Success Criteria
- [ ] Gate green; pushed; live PDP shows the button once the key is set and
      a real generation succeeds in production.

## Testing Strategy
- No automated test suite; each phase gated by `npx tsc --noEmit` +
  `npm run build` plus the manual steps above.
- Needs: a `GEMINI_API_KEY` (free from https://aistudio.google.com — user
  creates it), one full-body test photo, and 2-3 products with clean
  on-model/flat garment images.
- Edge products to spot-check: a product with per-color images (color switch
  test) and one with only a single shared image.

## References
- Research: `workflow/research/2026-07-04-virtual-try-on-pdp.md`
- Client upload idiom: `src/app/(shop)/customize/CustomizeForm.tsx:114-133`
- Inline overlay idiom: `src/components/shop/ProductGallery.tsx:163-220`
- Insertion points: `src/components/shop/ProductView.tsx:86-90, 115-121`
- Route validation style: `src/app/api/upload/route.ts:30-98`
- Industry standard considered: photo-upload AI try-on widgets (GenLook on
  Shopify — the reference site's vendor; FASHN API as the API-first
  equivalent). This plan reproduces that UX with a first-party Gemini
  2.5 Flash Image call (~$0.039/img vs FASHN $0.075/img), matching the
  repo's server-side-secret proxy convention. Sources: genlook.app,
  fashn.ai/products/api, ai.google.dev/gemini-api/docs/pricing.
