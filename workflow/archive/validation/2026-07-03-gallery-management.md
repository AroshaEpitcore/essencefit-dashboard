---
date: 2026-07-03
slug: gallery-management
plan: workflow/archive/plans/2026-07-03-gallery-management.md   # archived post-validation
repo_commit: b59e5ce   # feature; + follow-up commit capping ?show= (this commit)
verdict: pass
---

# Validation Report: Custom Orders Gallery

> Single-repo essencefit-dashboard app — the gate is `npx tsc --noEmit` +
> `npm run build` (no backend/app/public-site split, no test suites exist).

## Implementation Status (per phase)
- ✓ Phase 1: Database + data layer — fully implemented; tables verified live
  on Supabase via `to_regclass` (both non-null). `columnCase.ts` entries were
  added **by hand** — running `gen-colmap.mjs` would have deleted still-needed
  reviews entries (its sources were never updated for db/23+; generator is
  effectively stale, map is hand-maintained now).
- ✓ Phase 2: Admin CRUD — fully implemented at `(main)/store-gallery/`
  (accepted deviation, see below); sidebar entry added; not in
  ADMIN_ONLY_ROUTES, matching the reviews baseline.
- ✓ Phase 3: Storefront — fully implemented (3 components, `/gallery` page,
  home section, header links desktop+mobile, sitemap entry).
- ✓ Phase 4: Ship — committed `b59e5ce`, pushed to `main`, Vercel deploy
  verified live on essencefits.com (see below).

## Layer 1 — Deterministic gate
- ✓ `npx tsc --noEmit` — pass (re-run post-ship and after the cap fix)
- ✓ `npm run build` — pass; route table shows `ƒ /gallery` and
  `○ /store-gallery`
- ✓ Local prod smoke test: `/`, `/gallery`, `/gallery?q=test`,
  `/store-gallery` all 200
- ✓ **Live deploy check** (essencefits.com): `/gallery` 200,
  `/gallery?q=test` 200, `/store-gallery` 200, sitemap contains
  `https://essencefits.com/gallery`, homepage header contains the
  `/gallery` link

## Layer 2 — Semantic review (code-reviewer)
Verdict: **approve with nits** — no blocking findings.

### Matches plan
- All layers mirror the customer-reviews model feature: parent+child tables
  with index, batched `attachGalleryImages` (no N+1), published-only filter
  and `IsFeatured DESC, SortOrder, CreatedAt DESC` ordering in the data layer,
  delete-children-first / replace-image-set admin actions, single-file client
  admin page, black-panel home section, lazy-loaded images.
- Column casing round-trips correctly through the pg shim; `q` search is
  parameterized (`ILIKE @q`) — no injection path.
- No scope creep; `/customize`, reviews, and upload validation untouched
  except the single `gallery` allow-list entry (image-only, 5MB — correct).
- `"use server"` actions are unauthenticated, but identical in exposure to
  the existing reviews actions — convention baseline, not a new deviation.

### Deviations from plan
- **Admin route is `/store-gallery`, not `/gallery`** (sidebar label still
  "Gallery"). Required: route groups don't affect URLs, so `(main)/gallery` +
  `(shop)/gallery` would both resolve to `/gallery` and break the build. The
  public page keeps the SEO-relevant `/gallery` URL. Accepted + noted in plan.

### Issues found
- **[should-fix — FIXED in follow-up commit]** unbounded `?show=` limit —
  `src/app/(shop)/gallery/page.tsx` passed a user-controllable value straight
  to `LIMIT @n` (and each returned row becomes an `IN` bind in
  `attachGalleryImages`). Now capped at 120.
- **[nit — left as-is]** `GalleryCard` count badge includes the artwork image
  (matches the lightbox total; defensible, just reads as product-photo count).
- **[nit — left as-is]** no-op `X AS X` aliases in gallery SQL (harmless; the
  columnCase map does the real conversion).
- **[nit — left as-is]** triple-redundant 6-item cap on the home section
  (fetch limit + length guard + slice) — belt-and-suspenders.

## Manual verification still required
- [ ] Admin → Gallery: create items (one featured, one without caption, one
      unpublished); verify list/edit/delete and image counts.
- [ ] Home: gallery section appears once items are published, featured first;
      "View the full gallery" works; section hidden when no published items.
- [ ] `/gallery`: search by customer name filters; Load more reveals more
      items; lightbox next/prev + keyboard + mobile tap targets; artwork
      thumbnail visible on cards; unpublished items never appear.

## Recommendation
**Pass.** Shipped and live. No test coverage backs this change (none exists in
the repo) — the manual checklist above is the remaining safety net once real
gallery items are entered.
