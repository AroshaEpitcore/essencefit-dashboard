---
date: 2026-07-05
slug: storefront-admin-gap-analysis
status: implementing   # draft | approved | implementing | shipped
surfaces: [storefront, admin, lib, db, ci]
research: workflow/research/2026-07-05-storefront-admin-gap-analysis.md
estimated_manual_effort: 2h 55m
---

# Hardening & Scale Round — Implementation Plan

## Overview
Close the hardening/scale gaps from the 2026-07-05 gap analysis that need no business decisions: DB indexes + duplicate-variant guard, pagination (admin + storefront), storefront performance (lazy images, working home ISR), error/loading boundaries + un-masked admin errors on money paths, serverless-safe rate limiting, CI, and real sequential invoice numbers.

## Estimated Manual Effort
**2h 55m** — total human-in-the-loop time only: overviewing/reviewing each phase, manual verification at each pause, and the final `/validate`. Implementation is done by Claude Code, so **no development hours are counted**. Includes a 10% buffer.

## Current State
- Single Next.js 16 repo (App Router; `(shop)` storefront, `(main)` admin, `(auth)` admin login) on Supabase Postgres via the mssql-compat shim (`src/lib/sqlShim.ts`), deployed on Vercel from `main`. As of commit `5062238`: server-side admin auth (`src/proxy.ts` + `requireAdmin()`), guarded stock decrements, forgot-password, admin new-order bell, status emails, and the `{ ok, error }` pattern (`src/lib/userError.ts`) on storefront auth/checkout actions.
- Gaps this plan closes (research doc numbers): #16 load-all admin pages, #17 no `/shop` pagination, #18 missing indexes, #19 home-page weight/ISR, #22 no CI, #23 no error/loading boundaries, #24 no rate limiting, #28 UUID invoice numbers, #35 admin error masking (money paths), plus the duplicate-variant data quirk (two "XL / White" rows on Ck Sport short).

## Desired End State
- Hot queries hit indexes; duplicate size/colour variant rows are merged and structurally impossible to recreate.
- Website Orders / Customers / Stock History / DTF Orders load 50 rows per page with server-side search; `/shop` and `/category` page by 24 with a pager and result counts.
- Home page serves from a 60s ISR cache; storefront images below the fold lazy-load.
- A DB outage or crash shows branded error pages, not the Next.js default; admins see real reasons ("Not enough stock. In stock: 2") instead of the masked production error on order/sale/return/stock/user mutations.
- 6th wrong password in 10 minutes is refused with a clear message, on customer login, admin login, reset requests, and checkout.
- Every push to `main` runs type-check + build + the security & smoke specs in GitHub Actions before Vercel's deploy finishes.
- New orders get `INV-1001`-style sequential invoice numbers shown on invoices, the orders list, and WhatsApp messages.

## What We're NOT Doing
- Payment gateway, coupon codes, customer-submitted reviews, account-synced wishlist, per-order returns/refunds, `/category` filter UI (P1 features — separate plan; reviews + coupons already green-lit by the owner for the next round).
- Soft-delete/audit-trail, report CSV exports, admin mobile layout, SEO/a11y polish, error-tracking SaaS (Sentry), checkout round-trip batching (#20), FK `ON DELETE` behaviors (#21) — later rounds.
- Converting all ~183 admin actions to `{ ok, error }` — only the money-path mutations listed in Phase 4.
- Running the full order-flow E2E in CI (it places real orders in the live DB — stays local).

## Touchpoints per surface
> Single repo — the "contract" is between server actions and their pages, plus the DB schema.
- **DB (`db/pg/`)**: new patch file `db/pg/patches/2026-07-05-hardening.sql` applied via `node db/pg/apply.mjs`; same statements appended to `db/pg/schema.sql` for fresh installs. New sequence + `orders.invoiceno` column (Phase 6). New `auth_attempts` table (Phase 5).
- **Lib (`src/lib/`)**: `storefront.ts` (paged `searchProducts`), new `rateLimit.ts`, `userError.ts` reused, `pdfGenerator.ts` + invoice display (Phase 6).
- **Admin (`src/app/(main)/`)**: web-orders, customers, stock-history, dtf-orders actions+pages (pagination); orders/sales/returns/dtf-orders/stocks/users/web-orders actions+pages (unmasked errors); `(main)/error.tsx`.
- **Storefront (`src/app/(shop)/`)**: shop + category pages (pager), layout + `AccountMenu` (client session fetch), image components (lazy), `(shop)/error.tsx`, `(shop)/loading.tsx`.
- **Auth (`src/app/(auth)/`)**: `loginUser` rate-limited + converted to `{ ok, error }`.
- **CI (`.github/workflows/`)**: new `ci.yml`. Requires repo secrets: `DATABASE_URL`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (manual step for the owner).
- **Tests (`test/`)**: pagination + rate-limit + invoice assertions added to existing specs where cheap.

---

## Phase 1: Database hardening (indexes + duplicate-variant merge & guard)

### Changes
#### Patch — `db/pg/patches/2026-07-05-hardening.sql` (new; also appended to `db/pg/schema.sql`)
```sql
-- Hot-path indexes (gap #18)
CREATE INDEX IF NOT EXISTS ix_orderitems_orderid       ON orderitems(orderid);
CREATE INDEX IF NOT EXISTS ix_orderitems_variantid     ON orderitems(variantid);
CREATE INDEX IF NOT EXISTS ix_productvariants_productid ON productvariants(productid);
CREATE INDEX IF NOT EXISTS ix_stockhistory_variantid   ON stockhistory(variantid);
CREATE INDEX IF NOT EXISTS ix_stockhistory_createdat   ON stockhistory(createdat);
CREATE INDEX IF NOT EXISTS ix_sales_variantid          ON sales(variantid);
CREATE INDEX IF NOT EXISTS ix_sales_saledate           ON sales(saledate);
CREATE INDEX IF NOT EXISTS ix_products_categoryid      ON products(categoryid);
CREATE INDEX IF NOT EXISTS ix_orders_source_orderdate  ON orders(source, orderdate DESC);
```
#### Merge script — `db/pg/patches/2026-07-05-merge-duplicate-variants.mjs` (new, one-time)
For each `(productid, sizeid, colorid)` group with >1 row (both ids non-null): keep the row with the most stock history, repoint `orderitems.variantid`, `sales.variantid`, `stockhistory.variantid`, `productimages.variantid`, `dtforders.variantid` to the keeper, add the duplicate's `qty` to the keeper, delete the duplicate. Runs in one transaction; prints every merge. Then the guard goes in the patch file:
```sql
-- No two variant rows for the same product+size+colour (the Ck XL/White case)
CREATE UNIQUE INDEX IF NOT EXISTS ux_variants_product_size_color
  ON productvariants(productid, sizeid, colorid)
  WHERE sizeid IS NOT NULL AND colorid IS NOT NULL;
```

### Success Criteria
#### Automated (deterministic gate — must be green)
- [x] `node db/pg/patches/2026-07-05-merge-duplicate-variants.mjs` reports 0 remaining duplicate groups on re-run
- [x] `node db/pg/apply.mjs db/pg/patches/2026-07-05-hardening.sql` applies cleanly (idempotent on re-run)
- [x] `npx tsc --noEmit` · `NODE_OPTIONS=--dns-result-order=ipv4first npm run build`
- [x] `npx playwright test` — full local suite green (order flow proves nothing broke — 20 passed, 1 data-dependent skip)
#### Manual (human verification)
- [x] PDP for Ck Sport short: XL/White now buyable (shows the merged stock), admin Stocks shows one XL/White row — confirmed 2026-07-05

**Pause here** for human manual-test confirmation before the next phase.

---

## Phase 2: Admin pagination (Website Orders, Customers, Stock History, DTF Orders)

### Changes
Model on the existing order-logs pattern (`order-logs/actions.ts:78` — `LIMIT @limit OFFSET @offset` + `total`), page size 50.
#### `src/app/(main)/web-orders/actions.ts` + `page.tsx`
`getWebOrders({ limit, offset, search?, unverifiedOnly? })` → `{ rows, total, unverifiedTotal }`; search is server-side `ILIKE` on customer/phone/id-prefix. Page keeps the tab counts from the returned totals; pager (`Prev / Next · showing X–Y of Z`); the 30s auto-refresh reloads the **current** page/filters.
#### `src/app/(main)/customers/actions.ts` + `page.tsx`
`getCustomers({ limit, offset, search? })` → `{ rows, total }` (search on name/phone/email). The aggregate JOIN stays; it now aggregates 50 rows, not all.
#### `src/app/(main)/stock-history/actions.ts` + `page.tsx`
Add `limit/offset` + `total` to the existing filter params; CSV export keeps exporting the **filtered** set with a 5 000-row cap (explicit in the button label).
#### `src/app/(main)/dtf-orders/actions.ts` + `page.tsx`
Same `{ rows, total }` shape; status filter moves server-side.

### Success Criteria
#### Automated
- [x] `npx tsc --noEmit` · build · `npx playwright test` (order-flow test 2/4 still finds fresh orders on page 1 — 20 passed)
#### Manual
- [x] Each of the four pages shows the pager, search returns server-filtered results, page 2 works, web-orders auto-refresh doesn't reset the page — approved 2026-07-05 (user waived per-phase pauses)

**Pause here** for human manual-test confirmation before the next phase.

---

## Phase 3: Storefront pagination + performance

### Changes
#### `src/lib/storefront.ts` — `searchProducts`
Add `limit`/`offset` params + a `COUNT(*)` twin query → return `{ products, total }`. Default 24/page.
#### `src/app/(shop)/shop/page.tsx` + `category/[slug]/page.tsx`
Read `?page=N` from searchParams; render a numbered pager (server-rendered links, SEO-safe) + "Showing X–Y of Z". Filters/sort/search keep their existing query params.
#### Lazy images
`loading="lazy" decoding="async"` on: `ProductCard.tsx` main+hover images, home slider cards, header mega-menu images, `ProductGallery.tsx` thumbnails (main image stays eager), cart/checkout/order thumbnails. `Hero.tsx`: first slide stays eager (`fetchpriority="high"`), later slides lazy.
#### Home ISR fix (`(shop)/layout.tsx` + `src/components/shop/AccountMenu.tsx`)
The layout's `getCurrentCustomer()` call forces every storefront page dynamic (`(shop)/page.tsx:14-20` documents this). Move session lookup client-side: `AccountMenu` becomes a client component that calls the existing `getMyAccount()` server action on mount (pattern already used by `checkout/page.tsx:55`). Layout no longer touches cookies → home `revalidate = 60` becomes real. PDP/category/shop keep `force-dynamic` (live stock).

### Success Criteria
#### Automated
- [x] `npx tsc --noEmit` · build — build output lists `/` as ISR (`○ / 1m 1y` = revalidate 60), not `ƒ`; `/shop` + `/category/[slug]` stay `ƒ`; login/register/reset build as `○` static — verified 2026-07-11 (commit 382b179 working tree)
- [x] `npx playwright test` — full suite (checkout + login flows prove the client-side AccountMenu works) — 21/21 passed, AutoTest orders cleaned up — verified 2026-07-11
#### Manual
- [ ] `/shop` pager works with filters combined; second home load is visibly instant; logged-in name still appears in the navbar (may appear a beat after paint)

**Pause here** for human manual-test confirmation before the next phase.

---

## Phase 4: Error/loading boundaries + un-masked admin errors (money paths)

### Changes
#### New files: `src/app/(shop)/error.tsx`, `src/app/(shop)/loading.tsx`, `src/app/(main)/error.tsx`, `src/app/global-error.tsx`
Branded "Something went wrong" + retry (`reset()`), storefront-light / admin-dark styling; `loading.tsx` = lightweight skeleton grid.
#### Un-mask money-path admin actions (gap #35) — same `UserFacingError` / `{ ok:false, error }` pattern as the storefront (`src/lib/userError.ts`)
Convert these actions **and their page call sites** (toast the returned `error`):
- `orders/actions.ts`: `createOrder`, `updateOrder`, `updateOrderStatus`, `deleteOrder` (internal callers keep a throwing `updateOrderStatusCore`; the exported wrapper returns the result — `web-orders` `verifyWebPayment`/`setWebOrderStatus` wrap it too)
- `sales/actions.ts`: `sellStock` · `returns/actions.ts`: `createSalesReturn`
- `dtf-orders/actions.ts`: confirm/status/pricing · `stocks/actions.ts`: `addProduct`, `quickStock`, `transferStock`, `updateVariantPrices`
- `users/actions.ts`: all five (the "last Admin" guard messages must be readable) · `(auth)/login/actions.ts`: `loginUser`

### Success Criteria
#### Automated
- [x] `npx tsc --noEmit` · build · `npx playwright test` (admin verify→Paid & cancel-restock flows exercise the converted wrappers) — tsc + build clean, 21/21 passed, AutoTest orders cleaned up — verified 2026-07-11
#### Manual
- [ ] Try deleting the last Admin → the real message shows; sell more stock than exists on `/sales` → "Not enough stock…" shows; kill `DATABASE_URL` locally → branded error page instead of the Next default

**Pause here** for human manual-test confirmation before the next phase.

---

## Phase 5: Rate limiting (serverless-safe)

### Changes
#### Table (append to Phase 1 patch or its own patch)
```sql
CREATE TABLE IF NOT EXISTS auth_attempts (
  key text PRIMARY KEY,           -- e.g. 'clogin:0771234567' or 'alogin-ip:1.2.3.4'
  count int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);
```
#### `src/lib/rateLimit.ts` (new)
`consumeRateLimit(key, max, windowSec)` — one atomic `INSERT … ON CONFLICT DO UPDATE` that resets the window when expired, else increments; `RETURNING count`; returns `allowed: count <= max`. DB-backed because Vercel instances share nothing (in-memory limiters silently don't work there — industry standard is a shared store; the DB stands in for Redis at this traffic level).
#### Wiring (keyed by identifier AND by IP from `headers()` `x-forwarded-for`)
- `loginCustomer` + `loginUser`: 5 / 10 min → `{ ok:false, error: "Too many attempts — please wait a few minutes and try again." }`
- `requestPasswordReset`: 3 / 15 min per email + IP (still returns `{ ok: true }` shape to avoid enumeration; simply doesn't send)
- `createWebOrder`: 5 / 10 min per phone (order-spam guard)

### Success Criteria
#### Automated
- [ ] `npx tsc --noEmit` · build
- [ ] New E2E: 6th bad login shows the too-many-attempts message (added to `password-reset.spec.ts`'s login test with a throwaway key)
- [ ] `npx playwright test` — full suite (proves normal flows aren't throttled)
#### Manual
- [ ] 5 wrong admin passwords → 6th refused even with the correct password until the window passes

**Pause here** for human manual-test confirmation before the next phase.

---

## Phase 6: CI + sequential invoice numbers

### Changes
#### `.github/workflows/ci.yml` (new)
On push/PR to `main`: checkout → `npm ci` → `npx tsc --noEmit` → `npm run build` → `npx playwright install chromium` → `npx playwright test admin-security smoke` (read-only specs; the order-placing suite stays local). Env from repo secrets: `DATABASE_URL`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. **Manual step for the owner: add those four GitHub secrets** (Settings → Secrets and variables → Actions).
#### Invoice numbers (uses the `invoice_prefix` / `invoice_start_number` settings that already exist in the DB)
```sql
CREATE SEQUENCE IF NOT EXISTS orders_invoiceno_seq START 1001;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoiceno bigint;
-- backfill oldest→newest, then bump the sequence past the max
```
`createOrder` + `createWebOrder` set `invoiceno = nextval(...)` on insert. Display becomes `invoice_prefix + invoiceno` (e.g. `INV-1043`) in: `orders/invoiceActions.ts` (PDF + WhatsApp text), orders list, invoices page, admin web-orders card, customer order page ref stays the UUID short-ref (customer-facing tracking is unchanged).

### Success Criteria
#### Automated
- [ ] `npx tsc --noEmit` · build · `npx playwright test` (order-flow asserts the new order got a monotonically-increasing `invoiceno`)
- [ ] CI workflow green on the push (visible in GitHub Actions)
#### Manual
- [ ] Generate an invoice PDF → shows `INV-<n>`; place two orders → numbers increment by 1

**Pause here** — final `/validate` after this phase.

---

## Testing Strategy
- The deterministic gate for every phase: `npx tsc --noEmit`, `NODE_OPTIONS=--dns-result-order=ipv4first npm run build`, `npx playwright test` (full suite locally — runs against the **live** Supabase DB, shorts-only orders, `node test/db/cleanup-autotest-orders.mjs` afterwards).
- CI (from Phase 6) runs the read-only subset on every push; the order-placing specs remain a local pre-deploy step.
- Data safety: Phase 1's merge script is transactional and reports every change before commit; indexes are `IF NOT EXISTS` (idempotent).

## References
- Research: `workflow/research/2026-07-05-storefront-admin-gap-analysis.md` (gaps #16–#19, #22–#24, #28, #35)
- Patterns to follow: `order-logs/actions.ts:78` (pagination), `src/lib/userError.ts` + `checkout/actions.ts` (result pattern), `checkout/page.tsx:55` (client session fetch), `.github/workflows/keepalive.yml` (Actions + secrets)
- Industry standard considered: shared-store (Redis-style) rate limiting for serverless — matched via a Postgres upsert since no Redis exists here; offset pagination with totals (standard for admin tables at this scale; keyset unnecessary <100k rows); ISR + client-fetched auth state is the canonical Next.js pattern for personalised headers on cached pages.
