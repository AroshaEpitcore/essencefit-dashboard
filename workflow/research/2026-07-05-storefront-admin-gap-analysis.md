---
date: 2026-07-05
topic: "Gap analysis of the EssenceFit storefront (website) and admin panel — what is missing and what needs improvement"
repo_commit: af46503
status: complete
tags: [research, storefront, admin, checkout, auth, database, testing, seo, performance]
---

# Research: Storefront & Admin Gap Analysis

## Research Question
What did we miss in the website (storefront) and admin panel — what is absent or needs improvement?

This is a whole-app sweep (single repo: Next.js 16 App Router, route groups `(shop)` storefront / `(main)` admin / `(auth)` admin login, Supabase Postgres via `src/lib/sqlShim.ts`, deployed on Vercel at essencefits.com). Facts below are as of commit `af46503` (2026-07-05) — i.e. AFTER this week's fixes (server-side admin auth, checkout stuck-navigation fix, POD-badge/HasAccount BIT fix, E2E suite).

## Summary

The core commerce loop is solid: browse → cart → checkout (COD / bank slip) → admin verify → Paid → sales rows, with stock kept consistent through one shared blank-aware resolver (`dbo.fn_StockVariantId`), transactional order writes, owner + customer emails, and an E2E suite covering the order flow and admin security. The biggest genuine gaps cluster in five areas:

1. **One critical bug**: admin **Users → Add user stores the password in PLAINTEXT** (no bcrypt), and those users can't log in at all.
2. **Money-path robustness**: checkout stock decrement has **no row lock** (two simultaneous buyers can oversell), no double-submit protection on order creation, and several hot FK columns have **no DB index**.
3. **Customer self-service**: **no forgot-password**, no online payment gateway, no coupons, no customer-submitted reviews, wishlist/cart are localStorage-only.
4. **Scale ceilings**: most admin list pages **load every row** with client-side filtering; `/shop` has no pagination; the home page ships ~150 un-lazy `<img>`s and its ISR is disabled by a cookie read in the layout.
5. **Operational blind spots**: no error tracking, no CI running the tests, no `error.tsx`/`loading.tsx` anywhere, no admin alert when a new web order arrives (email only), fire-and-forget emails with no retry.

## Prioritized Gap List

### P0 — bugs / security (broken today)
| # | Gap | Where |
|---|-----|-------|
| 1 | **Add-user stores plaintext password** in `PasswordHash`; bcrypt-compare at login then always fails, so admin-created users are both insecure and unable to log in | `src/app/(main)/users/actions.ts:20-31`, `users/page.tsx:48` |
| 2 | **Checkout oversell race**: stock check + `UPDATE Qty = Qty - @Qty` without `FOR UPDATE` or `WHERE Qty >= @Qty`; no CHECK constraint stops negative stock | `src/app/(shop)/checkout/actions.ts:79-98,228`; only DTF locks rows (`dtf-orders/actions.ts:93,212`) |
| 3 | Malformed template literal in stocks delete confirm — shows `Delete this Rs.{type}?` | `src/app/(main)/stocks/page.tsx:399` |
| 4 | `SESSION_SECRET` falls back to a **hardcoded dev secret** if unset — tokens would be forgeable; no startup guard | `src/lib/adminAuth.ts:22`, `customerAuth.ts:15`, `proxy.ts:49` |
| 5 | `/api/upload` is **unauthenticated** (any internet caller can push ≤60 MB files into the public bucket; needed by guest checkout slips, but has no rate limit / origin check either) | `src/app/api/upload/route.ts` |

### P1 — high-value product gaps
| # | Gap | Where |
|---|-----|-------|
| 6 | **No forgot-password / reset flow** for customers (or admin users); no password-reset email exists | grep = 0 matches repo-wide |
| 7 | **No online payment gateway** — COD + manual bank-slip only (locally relevant options: PayHere/WEBXPAY/onepay) | `checkout/page.tsx:44`, `checkout/actions.ts:188` |
| 8 | **No coupon/discount codes** — `ManualDiscount=0, Discount=0` hardcoded at web checkout | `checkout/actions.ts:191-192` |
| 9 | **Customers cannot submit reviews** — reviews are 100% admin-curated | only `(main)/reviews/actions.ts:130` inserts |
| 10 | **No new-web-order alert in admin** — no notification type, no sound/browser notification, web-orders page doesn't auto-refresh (manual button; `/orders` polls 30s) | `src/lib/getNotifications.ts`, `web-orders/page.tsx:42-52` |
| 11 | **No admin user password reset/change** after creation; no deactivate (hard delete only), no "can't delete last admin/self" guard | `users/actions.ts:37-59` |
| 12 | Wishlist is localStorage-only — lost across devices; never linked to the account | `WishlistContext.tsx:25` |
| 13 | No email on order **status changes** (Paid/Completed/Canceled) to the customer — only the initial confirmation | `orderNotify.ts` call sites |
| 14 | `/category/[slug]` has **no filters/sort UI** (unlike `/shop`) | `category/[slug]/page.tsx:33` |
| 15 | Returns are not launched from an order and compute **no refund amount**; no per-order return button | `returns/actions.ts:98` |

### P2 — scale & performance ceilings
| # | Gap | Where |
|---|-----|-------|
| 16 | **Load-ALL-rows admin pages** (no LIMIT): web-orders, customers, stock-history, dtf-orders, expenses, suppliers, reviews, dispatch, settings, color-requests, reports; orders search silently caps at 1000 | e.g. `web-orders/actions.ts:11-26`, `customers/actions.ts:61`, `orders/page.tsx:301-303` |
| 17 | **No pagination on `/shop` / `/category`** — `searchProducts` has no LIMIT/OFFSET | `src/lib/storefront.ts:292` |
| 18 | **Missing DB indexes** on hot FKs: `orderitems.orderid`, `productvariants.productid`, `stockhistory.variantid`, `products.categoryid`, `sales.variantid` | `db/pg/schema.sql:410-426` |
| 19 | **Home page weight**: ~100 gallery + ~36 product images, mostly without `loading="lazy"`; `next/image` unused repo-wide; home ISR (`revalidate=60`) disabled because the `(shop)` layout reads cookies | `(shop)/page.tsx:14-42`, `ProductCard.tsx:64`, `Hero.tsx:65` |
| 20 | Checkout does ~4 sequential DB round-trips **per cart line** inside the transaction (remote Supabase ≈ slow) | `checkout/actions.ts:205-237` |
| 21 | FKs have no `ON DELETE` behavior except sales→orders/dtforders CASCADE; only one CHECK constraint in the whole schema (`sales.qty > 0`) | `db/pg/schema.sql:430-448,148` |

### P3 — operational hygiene & polish
| # | Gap | Where |
|---|-----|-------|
| 22 | **No CI runs the tests** — only the Supabase keep-alive workflow exists; vitest configured but not even installed | `.github/workflows/keepalive.yml`, `package.json` |
| 23 | **No error tracking / structured logging** (console.* only); **no `error.tsx` / `loading.tsx` anywhere**; DB outage = default Next error page | glob = 0 files |
| 24 | **No rate limiting or CAPTCHA** on login (admin+customer), register, checkout, upload | `(auth)/login/actions.ts:8`, `account/actions.ts:12,70` |
| 25 | No session revocation (stateless HMAC cookies; logout ≠ invalidate; only rotating SESSION_SECRET kills leaked tokens); customer token verify is not timing-safe (admin's is) | `customerAuth.ts:31` vs `adminAuth.ts:44-48` |
| 26 | Hard DELETE everywhere (orders, customers, users, expenses…) — no soft-delete/audit trail; dispatch messages auto-purge after 7 days | e.g. `orders/actions.ts:842-853`, `dispatch/actions.ts:56-58` |
| 27 | No export (CSV/PDF) on dashboard, reports, analysis, finance, customers (exists only on inventory + stock-history + invoices) | `reports/page.tsx` (grep empty) |
| 28 | Invoice numbers are truncated UUIDs (collision-prone, non-sequential) despite `invoice_prefix`/`invoice_start_number` settings existing in the DB | `invoiceActions.ts:8`, settings table |
| 29 | No confirmation on money-affecting inline status changes (orders row select, web-orders select, bulk update); mixed `window.confirm` vs styled modals elsewhere | `orders/page.tsx:959`, `web-orders/page.tsx:156` |
| 30 | No double-submit/idempotency guard on `createOrder` (admin) — double-click ⇒ two orders | `orders/actions.ts:506` |
| 31 | Admin on mobile: sidebar never overlays (occupies width even collapsed), Topbar cluster + marquee don't collapse, orders table has no card fallback | `Sidebar.tsx:80-82`, `Topbar.tsx:70-121` |
| 32 | SEO gaps: client pages (cart/checkout/wishlist/login/register) export no metadata; no `opengraph-image`; `/shop?q=` has no canonical/noindex | `shop/page.tsx:8` |
| 33 | Accessibility: `alt=""` on many content thumbnails; AddToCart swatches rely on `title` only; search drawer/mega-menu lack dialog roles | `AddToCart.tsx:185,220`, `cart/page.tsx` |
| 34 | Misc: `/map` page not in sidebar (URL-only); `purchases/` dir is empty (no route); Finance shows raw `UserId` as "ManagerName" (no join); dark-mode toggle not persisted; low-stock thresholds hardcoded inconsistently (1–5 vs <10); `order-logs` count query neutralizes params with a `NULL` replace; contact form is a WhatsApp deep-link only; two tooltip libs + `node-fetch` in deps; no `.env.example` or env validation | `finance/actions.ts:126`, `analysis/actions.ts:115`, `order-logs/actions.ts:83` |
| 35 | **Server-action error messages are masked in production** (Next.js strips them), so every `catch (e) { toast.error(e.message) }` in the ADMIN pages shows "An error occurred in the Server Components render…" instead of the real reason (e.g. "Not enough stock", "can't delete the last Admin"). Discovered 2026-07-05 via the password-reset E2E; storefront-facing flows (login/register/reset/checkout) were converted to return `{ ok:false, error }` (`src/lib/userError.ts`) — the ~27 admin action files still throw | `src/lib/userError.ts`, every `(main)/*/actions.ts` |

## Detailed Findings

### Storefront `(shop)` — what exists
- 22 routes: home, shop (+filters/sort/search results), category, PDP (gallery, variant picker or design-per-image picker, reviews, related, JSON-LD), cart, checkout, order & DTF-order tracking, account (home/orders/profile/login/register), wishlist, deals, gallery (+load-more), customize (DTF form), feedback wall, about, contact, cookie-policy, 404.
- Checkout: guest forces account creation (password ≥6, auto-sign-in); server re-reads price+stock, transactional, province-based delivery fee with free-over threshold; COD + bank transfer with slip upload; owner + customer emails (Resend, domain verified 2026-07-05).
- SEO: per-page metadata on 16 pages, `generateMetadata` + canonical + OG on PDP/category/home, Organization/Website/Product/Breadcrumb JSON-LD, DB-driven `sitemap.ts`, `robots.ts` blocking admin/account paths.
- Search: header type-ahead (`quickSearch`, LIMIT 6) → `/shop?q=` full results.

### Admin `(main)` — what exists
- 30 sidebar pages covering dashboard KPIs/charts, inventory lookup + CSV, product/category/size/color CRUD, manual POS sales, manual orders (create/edit/delete/status/invoice PDF/WhatsApp/waybill→dispatch), web orders (verify slip → Paid), catalog & storefront content (reviews/gallery/feedback/store-settings), DTF pricing + order pipeline (with `FOR UPDATE` locking), order-logs (the only truly paginated page), finance (handovers/cash), expenses, returns (restock), customers, suppliers, reports (6 types), analysis (12 widgets, date range), users, stock-history + CSV, dispatch, WhatsApp composer, settings, map.
- Auth (since `af46503`, today): HMAC `ef_admin` cookie set at login, `src/proxy.ts` edge gate on all admin segments (401 for non-GET, redirect for GET, Staff bounced from 9 Admin-only segments), `requireAdmin()` in all 183 exported admin actions, `/register` locked to Admins (first-user bootstrap). The `(main)/layout.tsx` localStorage check is now cosmetic UX only.
- Notifications: 60s polling; types = out-of-stock, low-stock, stale-pending>24h, recent returns.

### Infrastructure — what exists
- `pg` pool (max 5/instance) via mssql-compat shim with PascalCase remap + numeric parsers; transactions on all money/stock paths; parameterized queries throughout (no injection surface found; the 3 `dangerouslySetInnerHTML` uses are JSON-LD only).
- Upload route with type/size allowlists → Supabase Storage; health endpoint; Supabase keep-alive cron (GitHub Actions Mon/Wed/Fri).
- Tests: Playwright E2E — 11-case order flow (shorts-only, live DB, `test/db/cleanup-autotest-orders.mjs`), 5-case admin security, smoke; `test:e2e` script. Unit/integration = stale placeholder smokes (vitest not installed).

## Code References
(Referenced inline per finding above; keystone files:)
- `src/app/(shop)/checkout/actions.ts` — web order transaction (stock race at :79-98,228)
- `src/app/(main)/users/actions.ts:20` — plaintext-password addUser
- `src/lib/storefront.ts:292` — unpaginated searchProducts
- `db/pg/schema.sql:410-448` — index/FK inventory
- `src/proxy.ts`, `src/lib/adminAuth.ts` — new admin gate
- `src/lib/getNotifications.ts` — admin alert types (no new-web-order type)
- `.github/workflows/keepalive.yml` — the only automation (no test CI)

## Related Prior Work (workflow/)
- `2026-06-21-automated-testing-coverage.md` — "zero automated testing / no middleware / localStorage-only admin auth" → **superseded** by the E2E suite + `af46503` auth layer; unit/integration + CI parts still open.
- `2026-06-21-order-and-stock-sync-audit.md` — its two gaps (cancel not restoring stock; orders not writing StockHistory) have since been **fixed** (`reconcileOrderStock`, checkout StockHistory writes); the shared `fn_StockVariantId` architecture it documents is current.
- `2026-06-23-supabase-migration.md`, `2026-06-23-customer-auth-and-navbar-refresh.md`, `2026-06-26-customer-reviews.md` (notes reviews had no captcha/spam design), `2026-07-03-new-order-notifications.md` (email-only owner alerts).

## Open Questions
- Which payment gateway does the business want (PayHere / WEBXPAY / onepay / bank-only stays)? Gateway choice shapes the whole P1 payments item.
- Are customer-submitted reviews wanted, or is admin curation deliberate brand control?
- Expected catalog/order growth — pagination priorities (P2) only bite at a few thousand rows; current volumes (~150 orders) are fine.
- Should admin-created users ever have been able to log in (i.e., is #1 blocking anyone today, or is registration-by-admin the only real path)?
