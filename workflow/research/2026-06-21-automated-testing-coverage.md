---
date: 2026-06-21
topic: "Automate testing for the whole storefront website and admin panel — cover account creation, website order placement, and all test cases"
repo: essencefit-dashboard
repo_commit: 6d409fa
backend_commit: 6d409fa
app_commit: n/a
public_site_commit: n/a
status: complete
tags: [research, testing, e2e, storefront, admin, server-actions, auth]
---

# Research: Automated testing coverage for storefront + admin panel

> NOTE: The `/research` skill is templated for the **Maraebiz** three-repo platform.
> This project is **`essencefit-dashboard`** — a single **Next.js 16 (App Router) + React 19 + SQL Server (mssql)** repo. There is no separate backend/app/public-site; the "backend" is Next.js **server actions** + one route handler, co-located with the UI. Findings below are mapped to that reality.

## Research Question
"Do all kinds of automated testing for the whole website and admin panel — cover all activity from account creation, website order placement, and all kinds of test cases should be automated." This research documents what exists today (test infra, the flows to cover, auth, data layer) so a test suite can be planned.

## Summary
- **There is currently zero automated testing.** No test runner, no test files, no CI config, no `test` script. `package.json` (`package.json:5-9`) has only `dev`, `build`, `start`. No Jest/Vitest/Playwright/Cypress/Testing-Library anywhere in deps (`package.json:10-37`).
- The app is a **single Next.js App Router repo** split into route groups: **`(shop)`** (customer storefront), **`(main)`** (admin panel), **`(auth)`** (admin login/register). Business logic lives almost entirely in **28 `actions.ts` server-action files**, not in HTTP APIs — the only route handler is `POST /api/upload` (`src/app/api/upload/route.ts:25`).
- **Two independent auth models**, both relevant to test setup:
  - **Customer (storefront):** HMAC-signed cookie `ef_customer` (`src/lib/customerAuth.ts:11,22,49,65`), keyed off the `Customers` table (rows with a non-null `PasswordHash`).
  - **Admin (panel):** **client-side only** — `loginUser` returns the user (`src/app/(auth)/login/actions.ts:7`), the client stores it in `localStorage.authUser`, and the `(main)` layout guards routes via the `useAuth` hook reading that localStorage value (`src/lib/useAuth.ts:24-47`, `src/app/(main)/layout.tsx:27-43`). There is **no admin cookie/session and no middleware** (`src/middleware.ts` does not exist).
- **Implication for testing:** the meaningful business rules (stock, pricing, customer linkage, order status → sales, DTF flow) are in server actions reachable both via the UI and, in principle, directly. E2E tests drive the UI; "integration" tests can call the server-action logic against a real/seeded SQL Server. Admin protection is purely UI-level, so E2E admin "login" = seeding `localStorage.authUser`.
- **Test data is provisionable today** via `db/apply.mjs <file.sql>` (runs a `.sql` against the `.env.local` DB, splitting on `GO`) plus the numbered migrations `db/00_*.sql … db/22_*.sql` and `db/seed.sql` / `db/seed_demo.sql`.

## Detailed Findings

### Current test infrastructure (none)
- No test files: searches for `*.test.*`, `*.spec.*`, `__tests__`, `playwright`, `cypress`, `vitest`, `jest` return nothing in `src/`.
- Scripts: `package.json:5-9` → `dev` / `build` / `start` only (all `next ... --turbopack`).
- Quality gate in use today is **`npx tsc --noEmit`** (used throughout this repo's work); there is no lint script either (`next lint` is not wired; an `.eslintrc`-style config exists but ESLint v9 default-config is absent).
- No CI workflow files (`.github/` not present for workflows).

### Tech stack & testability
- Next.js `^16.1.1`, React `19.2.3`, TypeScript `^5`, Tailwind 3 (`package.json:18,21,36`).
- Data access: `mssql` `^11` via a singleton pool (`src/lib/db.ts:16-21`), config from env `DB_USER/DB_PASSWORD/DB_SERVER/DB_NAME` (`src/lib/db.ts:3-12`).
- Pricing/stock helpers are pure-ish and unit-testable in isolation: `src/lib/dtfPricing.ts`, `src/lib/dtfSettings.ts`, `src/lib/colorHex.ts`, `src/lib/phoneMask.ts`, `src/lib/slug.ts`, `src/components/shop/format.ts` (`money`, `discountPct`, `sizeRank`). The blank-stock resolver is a **SQL function** `dbo.fn_StockVariantId` (`db/18_shared_stock.sql:24-42`), so stock logic can only be exercised against a real DB.

### Auth models (test entry points)
- **Customer cookie**: token = `base64url(payload).hmacSHA256(payload, SESSION_SECRET)` (`src/lib/customerAuth.ts:18-26`); `getCurrentCustomer` verifies + loads from `Customers` (`:49-62`); `setSessionCookie`/`clearSessionCookie` are httpOnly, sameSite=lax (`:65-79`). `SESSION_SECRET` is an env var (`.env.local`), so tests can mint valid cookies deterministically.
- **Admin localStorage**: `useAuth` reads `localStorage.authUser` → `{ Id, Username, Email, Role }` (`src/lib/useAuth.ts:5-38`); `canAccess` allows everything for `Role === "Admin"` and blocks `ADMIN_ONLY_ROUTES` for other staff (`:12-22,43-47`). `(main)/layout.tsx:31-42` redirects to `/login` if no user and to `/dashboard` if a staff user hits an admin-only route. There is **no server-side enforcement** on admin server actions.
- Admin accounts come from the `Users` table: `registerUser`/`loginUser` (`src/lib/auth.ts:7-46`) and the login route action (`src/app/(auth)/login/actions.ts:7-28`); `(auth)/register` exists too.

### Route surface to cover
**Storefront `(shop)` — 16 pages:** `/` (home), `/shop`, `/deals`, `/category/[slug]`, `/product/[slug]`, `/cart`, `/wishlist`, `/checkout`, `/order/[id]`, `/customize`, `/dtf-order/[id]`, `/account`, `/account/login`, `/account/register`, `/account/profile`, `/account/orders`.

**Admin `(main)` — 25 pages:** `/dashboard`, `/orders`, `/web-orders`, `/catalog`, `/stocks`, `/stock-history`, `/inventory`, `/sales`, `/returns`, `/purchases`(suppliers), `/suppliers`, `/customers`, `/dtf`, `/dtf-orders`, `/order-logs`, `/color-requests`, `/dispatch`, `/expenses`, `/finance`, `/reports`, `/analysis`, `/invoices`, `/map`, `/whatsapp`, `/settings`, `/store-settings`, `/users`.

**Admin auth `(auth)`:** `/login`, `/register`.

### Critical flows & the server actions behind them (priority test targets)
- **Customer account creation / login** — `registerCustomer` (links to guest by phone, hashes password, sets cookie) and `loginCustomer` (`src/app/(shop)/account/actions.ts:12-89`); `updateMyProfile` (`:207-228`); logout (`:91`).
- **Storefront order placement** — `createWebOrder` (`src/app/(shop)/checkout/actions.ts:51-255`): re-reads price/stock server-side, validates availability, computes province delivery fee, upserts/creates the customer account (auto sign-in), inserts `Orders`(`Source='web'`,`Pending`) + `OrderItems`, decrements blank-resolved stock, writes `StockHistory` + `OrderStatusLogs`. Config in `getCheckoutConfig` (`:18-27`).
- **Customer order views** — `getMyOrders` (regular + DTF, matched by CustomerId/phone/email, with thumbnails) and the ownership-checked `getMyOrder` / `getMyDtfOrder` (`src/app/(shop)/account/actions.ts:115-205` and the `getMyOrder` block); detail page `src/app/(shop)/order/[id]/page.tsx`; DTF tracking `src/app/(shop)/dtf-order/[id]/page.tsx`.
- **DTF / custom order placement** — `createDtfOrder` (`src/app/(shop)/customize/actions.ts:42-150`): inserts `DtfOrders`(`Pending`,`StockDeducted=0`) + `DtfOrderDesigns`, links customer; stock reserved later at admin Confirm.
- **Admin order entry (WhatsApp flow)** — `createOrder` / `updateOrder` / `updateOrderStatus` / `deleteOrder` (`src/app/(main)/orders/actions.ts:475,580+`), with the POD/design support and the POD-aware stock helpers `validateAndReduceStock` / `restoreStockFromOrder` / `resolveStock` (`:267-364`); lookups `getProductsByCategory` / `getDesignsByProduct` / `getVariant` (`:19,33+`). Status→`Sales` rows via `updateOrderStatus` (`insertSalesRows` / `shouldCreateSales`).
- **Web-order management (admin)** — `getWebOrders`, `verifyWebPayment` (→ `updateOrderStatus("Paid")`), `setWebOrderStatus` (`src/app/(main)/web-orders/actions.ts:6-49`).
- **Catalog & stock** — product/category/design CRUD, designs + POD flags (`src/app/(main)/catalog/actions.ts`); `saveDesigns`, image management; stock CRUD & `deleteProduct`/`deleteCategory` (`src/app/(main)/stocks/actions.ts:29,186`).
- **Cross-cutting business invariants worth asserting** (documented in `workflow/research/2026-06-21-order-and-stock-sync-audit.md`): single blank-resolved stock pool via `fn_StockVariantId`; web+admin reserve stock at creation, DTF at confirm; canceling a regular order does **not** restore stock (only edit/delete do); regular orders don't write `StockHistory` for sales except web checkout; Sales created only on Paid/Completed.

### File upload
- `POST /api/upload` (`src/app/api/upload/route.ts:25-77`): multipart, folder allowlist (`SAFE_FOLDERS`, `:21`), type allowlist (images/video; PDF only into `designs`), size caps (5MB image / 60MB video / 25MB design), writes to `public/uploads/<folder>/<uuid>.<ext>`, returns `{url, kind}`. Used by catalog images, payment slips, and DTF artwork — a dependency of order/catalog E2E flows.

### Data layer & test-DB provisioning
- Schema is a set of ordered idempotent migrations `db/00_init.sql … db/22_design_per_image.sql`, applied with the runner `db/apply.mjs` (`db/apply.mjs:1-51`) which reads `.env.local`, splits on `GO`, and `batch()`es each chunk. Seed data: `db/seed.sql`, `db/seed_demo.sql`.
- This is the existing, repeatable way to stand up / reset a database — the natural foundation for a test database fixture (apply migrations + a seed, run tests, tear down).
- Tables touched by the priority flows: `Customers`, `Users`, `Products`, `ProductVariants`, `ProductImages`, `Categories`, `Sizes`, `Colors`, `Orders`, `OrderItems`, `OrderStatusLogs`, `Sales`, `Purchases`, `StockHistory`, `DtfOrders`, `DtfOrderDesigns`. FK actions are all `NO_ACTION` (observed during the Caps deletion), so child rows must be handled explicitly.

## Code References
- `package.json:5-37` — no test script/deps; scripts are dev/build/start only.
- `src/lib/db.ts:3-21` — mssql singleton pool + env config.
- `src/lib/customerAuth.ts:11-79` — storefront cookie session (mintable via `SESSION_SECRET`).
- `src/lib/useAuth.ts:5-57` + `src/app/(main)/layout.tsx:27-43` — admin auth is localStorage-only, route guard client-side.
- `src/app/(auth)/login/actions.ts:7-28`, `src/lib/auth.ts:7-46` — admin user login/register against `Users`.
- `src/app/(shop)/account/actions.ts:12-228` — customer register/login/logout/profile + My-orders readers.
- `src/app/(shop)/checkout/actions.ts:18-255` — storefront order placement (stock, pricing, delivery, account, logs).
- `src/app/(shop)/customize/actions.ts:42-150` — DTF custom order placement.
- `src/app/(main)/orders/actions.ts:19-364,475+` — admin order entry + POD/design support + stock helpers + status→Sales.
- `src/app/(main)/web-orders/actions.ts:6-49` — web-order verify/status.
- `src/app/(main)/catalog/actions.ts`, `src/app/(main)/stocks/actions.ts:29,186` — catalog/stock/design CRUD.
- `src/app/api/upload/route.ts:25-77` — the only HTTP route handler.
- `db/apply.mjs:1-51`, `db/00..22_*.sql`, `db/seed*.sql` — schema/seed provisioning.

## Architecture / Conventions Observed
- **Logic in server actions** (`"use server"`), not REST controllers; UI pages (mostly `"use client"`) call them directly. Only one route handler (`/api/upload`).
- **Server-authoritative pricing/stock**: checkout and DTF re-read price/stock from the DB; client values are never trusted (`checkout/actions.ts:72-99`).
- **Transactions** wrap multi-write order operations (`new sql.Transaction`), with explicit child-row handling (no FK cascade).
- **`force-dynamic`** on data pages; reads done in server components, mutations in server actions.
- **Two auth surfaces**: cookie (customer) vs localStorage (admin). Quality gate today is `tsc --noEmit`.
- Test DBs are reproducible through the existing migration runner + seeds.

## Related Prior Work (from workflow/)
- `workflow/research/2026-06-21-order-and-stock-sync-audit.md` — the definitive map of order/stock/account/delivery invariants across web/admin/DTF; the **source of truth for what the order/stock tests must assert** (stock resolver, reserve timing, cancel-doesn't-restore, Sales-on-Paid).
- `workflow/research/2026-06-21-design-per-image-products.md` & `…/2026-06-21-single-item-no-variant-support.md` — design (select-by-image) and variant-less product behaviour relevant to product/order test cases.
- `workflow/research/2026-06-19-ecommerce-storefront-transformation.md` — original storefront/order/Sales model.
- No prior testing-specific research/plan exists (dedup checked across `workflow/research|plans|validation|archive`).

## Open Questions
(Decisions for the `/plan` phase — not resolved here.)
- **Test layers & tools**: which mix of E2E (Playwright vs Cypress), server-action/integration tests (Vitest/Jest), and pure unit tests for `lib/` helpers? The repo currently has none, so the runner(s) are a green-field choice.
- **Test database strategy**: dedicated test SQL Server DB provisioned via `db/apply.mjs` + a seed, reset between runs? Transactional rollback per test vs full re-seed? Docker SQL Server for CI?
- **Admin auth in E2E**: since admin is localStorage-only, do tests seed `localStorage.authUser` directly, or drive the real `/login` form? Coverage for the (currently UI-only) admin protection.
- **Customer auth in tests**: mint `ef_customer` cookies via `SESSION_SECRET`, or always go through the register/login UI?
- **Upload handling**: real file writes to `public/uploads` vs mocking `/api/upload` in E2E.
- **Scope/priority**: "all test cases" is broad (16 storefront + 25 admin pages). Which flows are P0 (account creation, web order, DTF order, admin order entry, payment verify, stock integrity) vs later (reports, finance, map, whatsapp)?
- **CI**: is a CI pipeline (GitHub Actions) in scope, including spinning up SQL Server?
- **Determinism**: handling province delivery fees, free-delivery thresholds, and time/date-based logic (delivery ETA) in assertions.
