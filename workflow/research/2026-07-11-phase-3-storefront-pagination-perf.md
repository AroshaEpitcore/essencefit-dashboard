---
date: 2026-07-11
topic: "Current uncommitted Phase 3 (storefront pagination + performance) implementation state — what exists, so it can be verified and finished"
backend_commit: 382b179
app_commit: n/a
public_site_commit: n/a
status: complete
tags: [research, storefront, pagination, isr, performance, phase-3]
---

# Research: Phase 3 storefront pagination + performance — as-implemented (uncommitted)

## Research Question
The working tree carries the uncommitted Phase 3 of `workflow/plans/2026-07-05-storefront-admin-gap-analysis.md` (plan status `implementing`; Phase 3 success-criteria boxes all **unchecked**). Document exactly what the Phase 3 code currently does — pagination, home-page ISR, client-fetched account state, lazy images, and the test-suite consequences — so it can be run through the gate and finished. This is a single Next.js 16 repo (not the three-repo Maraebiz layout the skill template assumes); the template is adapted accordingly.

## Summary
Phase 3 is **fully written in the working tree but never verified**. Three things changed structurally:

1. **Listing pagination.** `searchProducts()` now returns `{ products, total }` (was `StoreProduct[]`), pages via `LIMIT/OFFSET` with a twin `COUNT(*)` query, default 24/page. `/shop` and `/category/[slug]` read `?page=N`, show "Showing X–Y of Z", and render a new **server-rendered** `PageLinks` numbered pager that preserves filters.
2. **Home-page ISR is now real.** The `(shop)` layout no longer calls `getCurrentCustomer()` (i.e. no `cookies()` in the tree), so `(shop)/page.tsx`'s `export const revalidate = 60` finally takes effect. Account state moved **client-side**: `AccountMenu` is now a client component that calls the existing `getMyAccount()` server action on mount and on every route change. `StoreHeader` dropped its `customer` prop.
3. **Perf + fallout fixes.** Below-the-fold `<img>`s got `loading="lazy" decoding="async"` (first hero slide / first gallery image stay eager via `fetchPriority="high"`). Because the storefront is now statically rendered, three client pages using `useSearchParams()` were wrapped in `<Suspense>`, the checkout empty-cart redirect got a 150 ms guard, and the E2E suite adopted a new `hydratedFill` fixture to survive hydration.

`/shop` and `/category` intentionally **keep `force-dynamic`** (live stock); only the home route is ISR.

**Verification is the missing step** — no `tsc`/`build`/`playwright` run is recorded, and the plan's own Phase 3 automated gate ("build output lists `/` as ISR, not `ƒ`") is untested.

## Detailed Findings

### Data layer (`src/lib/`)
- `searchProducts(params)` signature changed to `Promise<{ products: StoreProduct[]; total: number }>` (`src/lib/storefront.ts:257-259`). Every caller must now destructure.
- `ProductQuery` gained `page?` and `pageSize?` (`src/lib/storefront.ts:251-253`).
- Page size is clamped `Math.min(Math.max(pageSize ?? 24, 1), 96)`; page floored at 1 (`storefront.ts:260-262`).
- A local `bind(req)` helper attaches all filter inputs so the same predicate bindings feed **both** the paged data query and the `COUNT(*)` twin query (`storefront.ts:263-272`). The `WHERE` clause array is built once and reused by both.
- Data query: `${PRODUCT_SELECT} WHERE … ORDER BY ${orderBy} LIMIT @Limit OFFSET @Offset` with `Limit`/`Offset` inputs (`storefront.ts:294-297`).
- Count query: `SELECT COUNT(*)::int AS "Total" FROM Products p LEFT JOIN Categories cat ON cat.Id = p.CategoryId WHERE …` (`storefront.ts:299-304`). Note it re-declares the `Products p` / `Categories cat` FROM+JOIN inline rather than reusing `PRODUCT_SELECT`; the `WHERE` predicates reference `p.*` and `cat.*` only, so the join set matches.
- `bind(req: any)` uses an explicit `any` param type (`storefront.ts:263`) — allowed under the project's TS config, but worth noting for the tsc gate.

### Storefront listing pages (`src/app/(shop)/`)
- `shop/page.tsx`: `PAGE_SIZE = 24`; reads `page = Math.max(1, Number(sp.page) || 1)`; passes `page`/`pageSize` into the query; destructures `{ products, total }`; header line becomes `Showing ${from}–${to} of ${total}`; renders `<PageLinks basePath="/shop" params={sp} … />`. Still `export const dynamic = "force-dynamic"` (`shop/page.tsx:6, 11, 19, 37-41, 65-71`).
- `category/[slug]/page.tsx`: same pattern; now also awaits `searchParams` for `page`; count line uses `total`; renders `<PageLinks basePath={`/category/${cat.Slug}`} params={sp} … />`. Still `force-dynamic` (`category/[slug]/page.tsx:9-14, 30-45, 66-77`).

### New pagination components
- `src/components/shop/PageLinks.tsx` (**new, storefront**): server component (plain `<Link>`s, SEO-safe). Returns `null` when `totalPages <= 1`. `href()` rebuilds the querystring from `params`, drops the existing `page`, and only sets `page` when `> 1` (so page 1 = clean URL). Renders a window of up to 5 page numbers centred on the current page, plus prev/next chevrons; current page marked `aria-current="page"` (`PageLinks.tsx:19-62`).
- `src/components/ui/Pager.tsx` (**new, admin — Phase 2 artifact**): `"use client"` Prev/Next control with an `onPage(page)` callback and "Showing X–Y of Z" window. Imported by `web-orders/page.tsx`, `stock-history/page.tsx`, `dtf-orders/page.tsx`. (Customers page paginates inline via `limit`/`offset` + `currentPage`, `customers/page.tsx:26-27, 53` — no `Pager` import.) Included here only because it is untracked alongside Phase 3; it belongs to already-verified Phase 2.

### Home-page ISR + client account state
- `(shop)/layout.tsx`: removed the `getCurrentCustomer` import and its `Promise.all` entry; dropped the `customer` prop passed to `StoreHeader`; added a comment explaining that reading the session here forced every page dynamic (`layout.tsx:10-24, 42`).
- `(shop)/page.tsx`: `export const revalidate = 60`, guarded by a comment warning that any `cookies()`/`headers()` in the route tree silently disables it (`(shop)/page.tsx:14-18`).
- `AccountMenu.tsx`: now `usePathname` + local `useState<NavCustomer>`; `useEffect` calls `getMyAccount()` on mount and whenever `pathname` changes, with an `alive` guard; `logout()` also clears local state before `router.refresh()`. No longer accepts a `customer` prop (`AccountMenu.tsx:20-56`).
- `getMyAccount()` already exists and returns `CustomerSession | null` (`src/app/(shop)/account/actions.ts:158`).
- `StoreHeader.tsx`: dropped the `NavCustomer` import and the `customer` prop from its signature and its `<AccountMenu>` render (`StoreHeader.tsx:11, 18-27, 244`). `NavCustomer` remains exported from `AccountMenu.tsx:9` but is now only referenced internally — no external consumers remain.

### Lazy images
- `ProductCard.tsx`: `loading="lazy" decoding="async"` on both base and hover images (`ProductCard.tsx:66-67, 77-78`).
- `Hero.tsx`: first slide `fetchPriority="high"`, later slides `loading="lazy"`; all `decoding="async"` (`Hero.tsx:65-73`).
- `ProductGallery.tsx`: main image `i===0` eager via `fetchPriority="high"`, rest lazy; all thumbnail rails lazy (`ProductGallery.tsx:98, 116-117, 158`).
- `StoreHeader.tsx` mega-menu / drawer images: lazy (`StoreHeader.tsx:357, 431, 545`).
- `cart/page.tsx:55` and `checkout/page.tsx:297`: thumbnail images lazy.

### Static-rendering fallout (consequences of the ISR change)
- **Suspense boundaries**: `account/login/page.tsx` (and per the diffstat, `register/page.tsx`, `reset/page.tsx`) split the form into an inner component wrapped in `<Suspense fallback={null}>` because `useSearchParams()` requires a Suspense boundary under static rendering (`login/page.tsx:5, 10, 67-76`). This is a hard build requirement — without it `npm run build` fails.
- **Checkout redirect guard**: `checkout/page.tsx:71-80` now defers the empty-cart → `/cart` redirect by a 150 ms `setTimeout` (cleared on unmount), to avoid bouncing a shopper on the transient empty frame before the cart's own effects settle on a fresh (now static) navigation.

### Test suite (`test/`)
- `test/fixtures/ui.ts` (**new**): `hydratedFill(page, selector, value)` — fills, waits 250 ms, asserts the value stuck, retries up to 30 s. Its header comment states the reason: "Storefront pages are static now (the (shop) layout no longer reads cookies), so the prerendered HTML is interactive-looking before React attaches" (`fixtures/ui.ts:3-16`).
- Adopted in `order-flow.spec.ts` (import at :21; used at :172 checkout name, :403 login) and `password-reset.spec.ts` (import at :4; used at :52, :60, :69, :76, :86). These are the first-field-touched sites on each page.

## Code References
- `src/lib/storefront.ts:251-307` — paginated `searchProducts` with `{ products, total }`, shared `bind()`, twin COUNT query
- `src/app/(shop)/shop/page.tsx:11-41,65-71` — `?page` read, Showing X–Y of Z, `PageLinks`
- `src/app/(shop)/category/[slug]/page.tsx:9-45,66-77` — same for category
- `src/components/shop/PageLinks.tsx:1-63` — new SEO server pager
- `src/components/ui/Pager.tsx:1-50` — new admin client pager (Phase 2)
- `src/app/(shop)/layout.tsx:10-42` — cookies removed from layout
- `src/app/(shop)/page.tsx:14-18` — `revalidate = 60`
- `src/components/shop/AccountMenu.tsx:20-56` — client-side `getMyAccount` fetch
- `src/app/(shop)/account/actions.ts:158` — `getMyAccount` server action (already existed)
- `src/components/shop/StoreHeader.tsx:11,18-27,244` — `customer` prop dropped
- `src/components/shop/Hero.tsx:65-73`, `ProductGallery.tsx:98,116-117,158`, `ProductCard.tsx:66-67,77-78` — lazy/eager image attrs
- `src/app/(shop)/account/login/page.tsx:5,67-76` — Suspense wrapper for `useSearchParams`
- `src/app/(shop)/checkout/page.tsx:71-80` — 150 ms empty-cart redirect guard
- `test/fixtures/ui.ts:10-16` — `hydratedFill`

## Architecture / Conventions Observed
- **Pagination split by surface**: admin uses a client `Pager` with an `onPage` callback (interactive tables); storefront uses server-rendered `PageLinks` (SEO/crawlable, clean page-1 URLs). Both compute `from/to`/`totalPages` the same way.
- **Offset pagination with a twin COUNT** is the pattern (matches `order-logs/actions.ts` cited in the plan). Bindings are shared between data and count via a single `bind()` closure so predicates can't drift.
- **ISR + client-fetched personalization** is the canonical Next.js pattern the plan targets: cache the page, hydrate per-user chrome (`AccountMenu`) on the client. The tradeoff is a one-frame anonymous navbar before `getMyAccount()` resolves.
- **`force-dynamic` retained deliberately** on `/shop` and `/category` for live stock; only `/` is ISR.
- Every non-`next/image` `<img>` carries the `// eslint-disable-next-line @next/next/no-img-element` convention already in the codebase.

## Related Prior Work (from workflow/)
- `workflow/plans/2026-07-05-storefront-admin-gap-analysis.md` — the parent plan; **Phase 3 §110-129** is the spec this implements. Phases 1 & 2 checked/verified; Phases 4-6 not started (no `error.tsx`/`loading.tsx`, `rateLimit.ts`, or `ci.yml` in the tree).
- `workflow/research/2026-07-05-storefront-admin-gap-analysis.md` — original gap analysis (gaps #17 no `/shop` pagination, #19 home weight/ISR are the Phase 3 drivers).
- Memory `e2e-order-flow-suite` — the Playwright suite runs against **live** Supabase, shorts-only, requires `node test/db/cleanup-autotest-orders.mjs` after.
- Memory `build-needs-ipv4-dns` — `npm run build` needs `NODE_OPTIONS=--dns-result-order=ipv4first` (Google Fonts). Directly relevant to the "build lists `/` as ISR" gate.

## Open Questions (verification checklist for the finish step)
1. **Does the build mark `/` as ISR (`revalidate 60`), not `ƒ` (dynamic)?** This is the core Phase 3 automated criterion and is currently unproven. Any stray `cookies()`/`headers()` in the `(shop)` tree would silently fail it.
2. **Does `tsc --noEmit` pass?** Watch `bind(req: any)` (explicit `any`) and the `fetchPriority: "high" as const` spreads (React 19 supports camelCase `fetchPriority`; confirm the JSX types accept it here).
3. **Do all three auth pages (login/register/reset) build?** Only `login` was diff-inspected in full; `register`/`reset` show the same +14-line Suspense shape in the diffstat — the build gate will catch any that were missed.
4. **Playwright**: full suite must stay green against live Supabase (esp. checkout + login flows that prove the client `AccountMenu` and the 150 ms checkout guard). Run cleanup after.
5. On finishing, tick the Phase 3 boxes in the plan and set the plan `status` appropriately.
